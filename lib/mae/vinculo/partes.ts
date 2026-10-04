// mae-vínculo — PARTES DA BASE (Sprint 5), puras e no formato da receita: lista pronta, marcar/desmarcar
// face numa parte, sugestão automática das equivalentes nos outros moldes.
import type { DocTrabalho } from '../schema'
import { caracteristicas, semelhanca, type FaceNoMolde } from '../faces/equivalentes'
import { facesDaReceita } from '../editor/moldes'
import { vizinhasDe } from '../faces/ferramentas'
import { proporcaoDaFace, ENQUADRAMENTO_PADRAO } from './enquadramento'
import type { Pt } from '../faces/geometria'

type Doc = DocTrabalho
type Parte = Doc['parts'][number]

/** Lista pronta da spec (renomeável; a usuária cria outras). */
export const PARTES_PADRAO = ['FRENTE', 'VERSO', 'LATERAL DIREITA', 'LATERAL ESQUERDA', 'FUNDO', 'FECHO SUPERIOR', 'ALÇA', 'ABA'] as const

export const idDaParte = (nome: string) => 'p_' + nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

/** Garante a lista pronta (só cria as que faltam; não mexe nas renomeadas). */
export function garantirPartesPadrao(d: Doc): void {
  if (d.parts.length) return
  for (const nome of PARTES_PADRAO) d.parts.push({ id: idDaParte(nome), name: nome, instances: [] })
}

export function novaParte(d: Doc, nome: string): string {
  let id = idDaParte(nome) || 'p_parte', n = 1
  while (d.parts.some(p => p.id === id)) id = `${idDaParte(nome)}_${++n}`
  d.parts.push({ id, name: nome.trim().slice(0, 60) || 'PARTE', instances: [] })
  return id
}

/** Acha a face (e o molde) pelo id. */
export function acharFace(d: Doc, faceId: string) {
  for (const m of d.molds) { const f = m.faces.find(x => x.id === faceId); if (f) return { molde: m, face: f } }
  return null
}

/** Parte da face (pela instância). */
export const parteDaFace = (d: Doc, faceId: string): Parte | null => d.parts.find(p => p.instances.some(i => i.faceId === faceId)) ?? null

/** Marca a face na parte (tira de outra parte, se estava). A 1ª face define a proporção da parte. */
export function atribuirFace(d: Doc, partId: string, faceId: string): void {
  const alvo = d.parts.find(p => p.id === partId)
  const af = acharFace(d, faceId)
  if (!alvo || !af || af.face.hole) return
  for (const p of d.parts) p.instances = p.instances.filter(i => i.faceId !== faceId)
  alvo.instances.push({ faceId, fit: { ...ENQUADRAMENTO_PADRAO, scale: 1, offsetX: 0, offsetY: 0, rotationDeg: 0 } })
  af.face.partId = partId
  if (!alvo.referenceAspect) alvo.referenceAspect = Math.round(proporcaoDaFace(af.face.polygonMm as Pt[]) * 1000) / 1000
}

export function desatribuirFace(d: Doc, faceId: string): void {
  for (const p of d.parts) {
    p.instances = p.instances.filter(i => i.faceId !== faceId)
    if (!p.instances.length) delete p.referenceAspect
  }
  const af = acharFace(d, faceId)
  if (af) delete af.face.partId
}

export function excluirParte(d: Doc, partId: string): void {
  const p = d.parts.find(x => x.id === partId)
  if (!p) return
  for (const i of p.instances) { const af = acharFace(d, i.faceId); if (af) delete af.face.partId }
  d.parts = d.parts.filter(x => x.id !== partId)
}

/** Todas as faces da base no formato das equivalentes. */
export function facesParaComparar(d: Doc): FaceNoMolde[] {
  return d.molds.flatMap(m => {
    const fe = facesDaReceita(m.faces)
    return fe.map((f, i) => ({ moldeId: m.id, faceId: f.id!, poligono: f.poligono, furo: f.furo, vizinhas: vizinhasDe(fe, i).filter(v => !fe[v].furo).length }))
  })
}

/**
 * Sugestão "auto": para cada molde que ainda NÃO tem face nesta parte, a face livre mais parecida com
 * as já marcadas (média das notas). É a MELHOR de cada molde (a nota aparece para a usuária julgar);
 * só fica de fora se nada no molde se parece (nota < `minimo`). Confirmar = 1 clique.
 */
export function sugerirParaParte(d: Doc, partId: string, minimo = 0.1): { moldeId: string; faceId: string; nota: number }[] {
  const parte = d.parts.find(p => p.id === partId)
  if (!parte?.instances.length) return []
  const todas = facesParaComparar(d)
  const car = caracteristicas(todas)
  const marcadas = parte.instances.map(i => todas.find(f => f.faceId === i.faceId)).filter(Boolean) as FaceNoMolde[]
  const ocupadas = new Set(d.parts.flatMap(p => p.instances.map(i => i.faceId)))
  const moldesComParte = new Set(marcadas.map(f => f.moldeId))
  const out: { moldeId: string; faceId: string; nota: number }[] = []
  for (const m of d.molds) {
    if (moldesComParte.has(m.id)) continue
    let melhor: { faceId: string; nota: number } | null = null
    for (const f of todas) {
      if (f.moldeId !== m.id || f.furo || ocupadas.has(f.faceId)) continue
      const cf = car.get(`${f.moldeId}/${f.faceId}`)!
      const nota = marcadas.reduce((s, g) => s + semelhanca(car.get(`${g.moldeId}/${g.faceId}`)!, cf), 0) / marcadas.length
      if (!melhor || nota > melhor.nota) melhor = { faceId: f.faceId, nota }
    }
    if (melhor && melhor.nota >= minimo) out.push({ moldeId: m.id, faceId: melhor.faceId, nota: Math.round(melhor.nota * 100) / 100 })
  }
  return out.sort((a, b) => b.nota - a.nota)
}
