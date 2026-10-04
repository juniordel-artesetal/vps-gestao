// mae-faces — SUGESTÃO DE FACES EQUIVALENTES (spec: proporção, área relativa, posição dentro do molde e
// número de vizinhas). Na Sprint 5 isto alimenta "marcou uma FRENTE → sugere as outras frentes".
import { area, caixa, centroide, type Pt } from './geometria'

export interface FaceNoMolde { moldeId: string; faceId: string; poligono: Pt[]; furo?: boolean; vizinhas: number }

export interface Caracteristicas { proporcao: number; areaRel: number; px: number; py: number; vizinhas: number }

/** Características de cada face, relativas ao próprio molde (independem do tamanho do molde). */
export function caracteristicas(faces: FaceNoMolde[]): Map<string, Caracteristicas> {
  const porMolde = new Map<string, FaceNoMolde[]>()
  for (const f of faces) if (!f.furo) { if (!porMolde.has(f.moldeId)) porMolde.set(f.moldeId, []); porMolde.get(f.moldeId)!.push(f) }
  const out = new Map<string, Caracteristicas>()
  for (const lista of porMolde.values()) {
    const total = lista.reduce((s, f) => s + area(f.poligono), 0) || 1
    const cm = caixa(lista.flatMap(f => f.poligono))
    for (const f of lista) {
      const c = caixa(f.poligono), [cx, cy] = centroide(f.poligono)
      out.set(`${f.moldeId}/${f.faceId}`, {
        proporcao: Math.min(c.w, c.h) / Math.max(c.w, c.h, 1e-9),
        areaRel: area(f.poligono) / total,
        px: cm.w ? (cx - cm.x0) / cm.w : 0.5,
        py: cm.h ? (cy - cm.y0) / cm.h : 0.5,
        vizinhas: f.vizinhas,
      })
    }
  }
  return out
}

/** Nota de 0 a 1: quanto b parece com a. */
export function semelhanca(a: Caracteristicas, b: Caracteristicas): number {
  const prop = Math.exp(-(((a.proporcao - b.proporcao) / 0.12) ** 2))
  const ar = Math.exp(-((Math.log(a.areaRel / b.areaRel) / 0.35) ** 2))
  const pos = Math.exp(-((Math.hypot(a.px - b.px, a.py - b.py) / 0.45) ** 2))
  const viz = Math.pow(0.8, Math.abs(a.vizinhas - b.vizinhas))
  return Math.pow(prop, 0.35) * Math.pow(ar, 0.3) * Math.pow(pos, 0.2) * Math.pow(viz, 0.15)
}

/** As faces mais parecidas com a face alvo (em todos os moldes), da mais para a menos parecida. */
export function sugerirEquivalentes(faces: FaceNoMolde[], alvo: { moldeId: string; faceId: string }, minimo = 0.6, limite = 12) {
  const car = caracteristicas(faces)
  const a = car.get(`${alvo.moldeId}/${alvo.faceId}`)
  if (!a) return []
  return faces
    .filter(f => !f.furo && !(f.moldeId === alvo.moldeId && f.faceId === alvo.faceId))
    .map(f => ({ moldeId: f.moldeId, faceId: f.faceId, nota: Math.round(semelhanca(a, car.get(`${f.moldeId}/${f.faceId}`)!) * 100) / 100 }))
    .filter(s => s.nota >= minimo)
    .sort((x, y) => y.nota - x.nota || x.moldeId.localeCompare(y.moldeId) || x.faceId.localeCompare(y.faceId))
    .slice(0, limite)
}
