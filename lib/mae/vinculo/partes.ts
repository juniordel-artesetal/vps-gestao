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

// Lote 16 (item 204): id CURTO (até 24 letras do nome) — o nome continua inteiro (até 60) como rótulo de tela; os
// nomes da lista pronta cabem inteiros, então os ids antigos não mudam. Repetido → "_2", "_3" (novaParte).
export const idDaParte = (nome: string) => 'p_' + nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24).replace(/_$/, '')

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

/**
 * Lote 3 (item 35): faces da base que ficam SEM papel no tema — as faces de uma parte que o tema ainda não vestiu
 * (ex.: a base ganhou um molde/parte nova depois que o tema foi feito). Abas sem parte não contam.
 * O tema avisa ("1 face nova sem papel") depois que a base ganhou moldes/faces.
 */
export function facesSemPapel(d: Doc, t: { partContent: Record<string, unknown[]>; faceContent?: Record<string, unknown[]> } | null): string[] {
  if (!t) return []
  const out: string[] = []
  for (const m of d.molds) for (const f of m.faces) {
    if (f.hole) continue
    if ((t.faceContent?.[f.id] ?? []).length) continue
    // faces sem parte são abas/sobras (a arte inteligente cobre) — só conta a face de uma parte ainda vazia
    const p = parteDaFace(d, f.id)
    if (p && !(t.partContent[p.id] ?? []).length) out.push(f.id)
  }
  return out
}

/**
 * Lote 17 (item 209): TEMA ANTIGO numa base de peças cuja parte de todas foi DIVIDIDA por peça — o conteúdo da parte
 * antiga é COPIADO para a parte nova de cada peça (decisão do Júnior: nada some; a usuária tira o que não quer), com
 * ids de camada novos; os ajustes "só nesta caixa", a ordem e os grupos das faces daquela peça seguem os ids novos.
 * Só copia para a parte que o tema ainda não tem (rodar de novo não duplica). Devolve se mudou.
 */
export function migrarPartesDoTema(base: { partesDivididas?: Record<string, Record<string, string>> }, t: {
  partContent: Record<string, { id: string }[]>; localOverrides?: Record<string, Record<string, unknown>>; ordemFace?: Record<string, string[]>
  grupos?: { id: string; parte: string; camadas: string[] }[]
}): boolean {
  let mudou = false
  for (const [velha, porPeca] of Object.entries(base.partesDivididas ?? {})) {
    const src = t.partContent[velha]
    if (!src?.length) continue
    for (const [molde, nova] of Object.entries(porPeca)) {
      if (nova === velha || t.partContent[nova]) continue
      const mapa = new Map<string, string>()
      const suf = `_${molde.slice(-4)}${Math.random().toString(36).slice(2, 5)}`
      t.partContent[nova] = (JSON.parse(JSON.stringify(src)) as { id: string }[]).map(c => { const id = `${c.id}${suf}`.slice(0, 120); mapa.set(c.id, id); return { ...c, id } })
      const daPeca = (fid: string) => fid.startsWith(`f_${molde}_`)
      for (const [fid, ajs] of Object.entries(t.localOverrides ?? {})) if (daPeca(fid)) t.localOverrides![fid] = Object.fromEntries(Object.entries(ajs).map(([k, v]) => [mapa.get(k) ?? k, v]))
      for (const [fid, ordem] of Object.entries(t.ordemFace ?? {})) if (daPeca(fid)) t.ordemFace![fid] = ordem.map(k => mapa.get(k) ?? k)
      for (const g of [...(t.grupos ?? [])]) if (g.parte === velha) t.grupos!.push({ ...JSON.parse(JSON.stringify(g)), id: `${g.id}__${molde.slice(-6)}`.slice(0, 120), parte: nova, camadas: g.camadas.map(k => mapa.get(k) ?? k) })
      mudou = true
    }
  }
  return mudou
}
