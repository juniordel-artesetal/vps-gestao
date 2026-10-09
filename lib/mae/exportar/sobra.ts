// mae-exportar — ARTE INTELIGENTE (Sprint 9): a região de impressão de cada face = o polígono da face
// expandido pela SOBRA (Clipper2, cantos em esquadria) menos as outras faces do molde — assim o conteúdo
// vaza além das arestas de CORTE, mas não invade a face vizinha (que tem a sua própria arte).
// Puro; tudo em mm.
import { differenceD, inflatePathsD, intersectD, unionD, FillRule, JoinType, EndType, type PathsD } from 'clipper2-ts'
import type { Pt } from '../faces/geometria'

const paraD = (p: Pt[]): { x: number; y: number }[] => p.map(([x, y]) => ({ x, y }))
const deD = (p: { x: number; y: number }[]): Pt[] => p.map(q => [Math.round(q.x * 1000) / 1000, Math.round(q.y * 1000) / 1000])

/** Polígono expandido pela sobra (mm). Esquadria com limite 2 (pontas agudas viram chanfro). */
export function expandir(poly: Pt[], sobraMm: number): Pt[][] {
  if (!sobraMm) return [poly]
  return (inflatePathsD([paraD(poly)], sobraMm, JoinType.Miter, EndType.Polygon, 2, 3) as PathsD).map(deD)
}

/**
 * Região de impressão da face: (face expandida) − (outras faces que não são furo). Devolve anéis (regra
 * par-ímpar) — às vezes mais de um pedaço.
 */
export function regiaoDeImpressao(face: Pt[], outras: Pt[][], sobraMm: number): Pt[][] {
  const exp = expandir(face, sobraMm).map(paraD)
  if (!outras.length) return exp.map(deD)
  const viz = unionD(outras.map(paraD), FillRule.NonZero) as PathsD
  // a própria face nunca é cortada (arredondamento nas bordas comuns não pode comer a face)
  const fora = differenceD(viz, [paraD(face)], FillRule.NonZero, 3) as PathsD
  return (differenceD(exp, fora, FillRule.NonZero, 3) as PathsD).map(deD).filter(p => p.length >= 3)
}

/**
 * Lote 5 (item 68): REGIÕES DE IMPRESSÃO de todas as faces de uma prancheta, como a Naty faz no Photoshop:
 *   1. um contorno ÚNICO = união das faces (de todos os moldes) ampliada pela sobra — acompanha o desenho;
 *   2. a faixa entre o corte e esse contorno é dividida entre as faces: cada face CRESCE a partir de si mesma
 *      em passos pequenos, e o que uma já ocupou a outra não pega (= a face mais próxima de cada ponto).
 * Assim a face só vaza pelas bordas de CORTE (a vizinha da dobra já está ocupada), nada passa do contorno,
 * nada se sobrepõe, e os vãos entre abas ficam com a face do lado. Furos ficam furos (folga de 1 mm).
 * Entrada/saída em mm da FOLHA. Resultado cacheado pela geometria (a massa repete a mesma base).
 */
export function regioesDeImpressao(faces: { id: string; poly: Pt[]; hole?: boolean }[], sobraMm: number, passoMm = 0.5): Map<string, Pt[][]> {
  const solidas = faces.filter(f => !f.hole && f.poly.length >= 3)
  const out = new Map<string, Pt[][]>()
  if (!solidas.length) return out
  if (!sobraMm) { for (const f of solidas) out.set(f.id, [f.poly]); return out }
  const chave = `${sobraMm}|${passoMm}|` + faces.map(f => `${f.id}${f.hole ? '!' : ''}:${f.poly.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')}`).join(';')
  const memo = CACHE.get(chave)
  if (memo) return memo
  const furos = faces.filter(f => f.hole && f.poly.length >= 3).map(f => paraD(f.poly))
  const furosMenores = furos.length ? (inflatePathsD(furos, -Math.min(1, sobraMm), JoinType.Miter, EndType.Polygon, 2, 3) as PathsD) : []
  // união com folga mínima (as faces se tocam pela dobra, o arredondamento deixa frestas) → contorno + sobra
  const juntas = unionD(inflatePathsD(solidas.map(f => paraD(f.poly)), 0.05, JoinType.Miter, EndType.Polygon, 2, 3) as PathsD, FillRule.NonZero) as PathsD
  let limite = inflatePathsD(juntas, sobraMm - 0.05, JoinType.Miter, EndType.Polygon, 2, 3) as PathsD
  if (furosMenores.length) limite = differenceD(limite, furosMenores, FillRule.NonZero, 3) as PathsD
  const reg = new Map<string, PathsD>(solidas.map(f => [f.id, [paraD(f.poly)]]))
  let ocupado = unionD(solidas.map(f => paraD(f.poly)), FillRule.NonZero) as PathsD
  const passos = Math.max(1, Math.ceil((sobraMm + 0.1) / passoMm))
  for (let k = 0; k < passos; k++) {
    for (const f of solidas) {
      const atual = reg.get(f.id)!
      const cresce = intersectD(inflatePathsD(atual, passoMm, JoinType.Miter, EndType.Polygon, 2, 3) as PathsD, limite, FillRule.NonZero, 3) as PathsD
      const novo = differenceD(cresce, ocupado, FillRule.NonZero, 3) as PathsD
      if (!novo.length) continue
      reg.set(f.id, unionD([...atual, ...novo], FillRule.NonZero) as PathsD)
      ocupado = unionD([...ocupado, ...novo], FillRule.NonZero) as PathsD
    }
  }
  // sobras de arredondamento (cantos agudos): ficam com a face mais próxima
  const resto = (differenceD(limite, ocupado, FillRule.NonZero, 3) as PathsD).filter(p => p.length >= 3)
  for (const p of resto) {
    const c = p.reduce((a, q) => [a[0] + q.x / p.length, a[1] + q.y / p.length], [0, 0]) as Pt
    let melhor = solidas[0], dmin = Infinity
    for (const f of solidas) { const d = distPoligono(c, f.poly); if (d < dmin) { dmin = d; melhor = f } }
    reg.set(melhor.id, unionD([...reg.get(melhor.id)!, p], FillRule.NonZero) as PathsD)
  }
  for (const f of solidas) {
    let r = reg.get(f.id)!
    if (furosMenores.length) r = differenceD(r, furosMenores, FillRule.NonZero, 3) as PathsD
    out.set(f.id, r.map(deD).filter(p => p.length >= 3))
  }
  if (CACHE.size > 40) CACHE.delete(CACHE.keys().next().value!)
  CACHE.set(chave, out)
  return out
}
const CACHE = new Map<string, Map<string, Pt[][]>>()

function distPoligono(p: Pt, poly: Pt[]): number {
  let d = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    const vx = b[0] - a[0], vy = b[1] - a[1], L = vx * vx + vy * vy
    const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L)) : 0
    d = Math.min(d, Math.hypot(p[0] - a[0] - t * vx, p[1] - a[1] - t * vy))
  }
  return d
}

/**
 * Lote 5 (item 68): quanto ampliar (em volta do centro do papel) a matriz do papel — quadrado unitário → mm —
 * para ele cobrir todos os `pontos` (a região de impressão da face). Exato com giro/inclinação.
 */
export function fatorParaCobrir(m: [number, number, number, number, number, number], pontos: Pt[]): number {
  const [a, b, c, d, e, f] = m
  const det = a * d - b * c
  if (!det || !pontos.length) return 1
  let max = 0.5
  for (const [x, y] of pontos) {
    const px = x - e, py = y - f
    const u = (d * px - c * py) / det, v = (-b * px + a * py) / det
    max = Math.max(max, Math.abs(u - 0.5), Math.abs(v - 0.5))
  }
  return Math.max(1, 2 * max * 1.02)
}

/** Fator para aumentar o papel em volta do centro do quadro, até cobrir a face + sobra (impressão). */
export function fatorDeSobra(w: number, h: number, sobraMm: number): number {
  if (sobraMm <= 0 || w <= 0 || h <= 0) return 1
  return Math.max((w + 2 * sobraMm) / w, (h + 2 * sobraMm) / h) * 1.02
}
