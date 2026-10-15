// Lote 18 (itens 218/226): o TEMA e a BASE dele — puro.
//  · 218: o que um tema tem que a base não tem mais (arte numa parte que saiu, ajuste num texto que saiu) = conflito
//    ao "Atualizar todos os temas desta base".
//  · 226: MOVER um tema para outra base — encaixa peças/caixas pelo nome (nomeDeCaixa), partes pelo nome, faces pela
//    ordem dentro da peça, textos pela variável (na face equivalente), arte pronta pela peça/página. Devolve o que
//    não encaixou.
import type { DocTema, DocTrabalho } from '../schema'
import { nomeDeCaixa } from '../exportar/planejar'
import { textoVale } from './textosDoTema'

type Base = Pick<DocTrabalho, 'id' | 'version' | 'parts' | 'molds' | 'textSlots' | 'artboards'>
const n = (s: string | undefined | null) => nomeDeCaixa(s ?? '')

/** O que o tema guarda e a base não tem mais (textos: os da base + os do próprio tema). */
export function conflitosTemaBase(base: Pick<DocTrabalho, 'parts' | 'molds' | 'textSlots'>, t: Pick<DocTema, 'id' | 'partContent' | 'faceContent' | 'textSlotAdjust'>): { partes: string[]; faces: string[]; textos: string[] } {
  const partes = new Set(base.parts.map(p => p.id))
  const faces = new Set(base.molds.flatMap(m => m.faces.map(f => f.id)))
  const textos = new Set(base.textSlots.filter(s => textoVale(s, t.id)).map(s => s.id))
  return {
    partes: Object.entries(t.partContent ?? {}).filter(([k, v]) => (v as unknown[]).length && !partes.has(k)).map(([k]) => k),
    faces: Object.entries(t.faceContent ?? {}).filter(([k, v]) => (v as unknown[]).length && !faces.has(k.split('~')[0])).map(([k]) => k),
    textos: Object.entries(t.textSlotAdjust ?? {}).filter(([k, a]) => !textos.has(k) && !(a as { hidden?: boolean }).hidden).map(([k]) => k),
  }
}
export const temConflito = (c: ReturnType<typeof conflitosTemaBase>) => c.partes.length + c.faces.length + c.textos.length > 0

/** As correspondências origem → destino (ids). */
export function mapaEntreBases(origem: Base, destino: Base) {
  const moldes = new Map<string, string>(), faces = new Map<string, string>(), partes = new Map<string, string>(), pranchetas = new Map<string, string>(), textos = new Map<string, string>()
  for (const m of origem.molds) {
    const d = destino.molds.find(x => n(x.name) === n(m.name)) ?? (origem.molds.length === 1 && destino.molds.length === 1 ? destino.molds[0] : undefined)
    if (!d) continue
    moldes.set(m.id, d.id)
    const fo = m.faces.filter(f => !f.hole), fd = d.faces.filter(f => !f.hole)
    fo.forEach((f, i) => { if (fd[i]) faces.set(f.id, fd[i].id) })
  }
  for (const p of origem.parts) { const d = destino.parts.find(x => n(x.name) === n(p.name)); if (d) partes.set(p.id, d.id) }
  origem.artboards.forEach((a, i) => { const d = destino.artboards.find(x => !!a.name && n(x.name) === n(a.name)) ?? destino.artboards[i]; if (d) pranchetas.set(a.id, d.id) })
  for (const s of origem.textSlots) {
    const f = faces.get(s.faceId)
    const d = destino.textSlots.find(x => !x.tema && x.variable === s.variable && x.faceId === f && ![...textos.values()].includes(x.id))
      ?? destino.textSlots.find(x => !x.tema && x.variable === s.variable && ![...textos.values()].includes(x.id))
    if (d) textos.set(s.id, d.id)
  }
  return { moldes, faces, partes, pranchetas, textos }
}

/**
 * Lote 18 (item 226): o tema na base `destino`. Os textos do próprio tema (dono = ele) vêm junto (devolvidos em
 * `textosDoTema`, para entrar na base destino). `conflitos` = nomes do que não encaixou (aviso na tela).
 */
export function moverTemaParaBase(t: DocTema, origem: Base, destino: Base): { tema: DocTema; textosDoTema: DocTrabalho['textSlots']; conflitos: string[] } {
  const mp = mapaEntreBases(origem, destino)
  const c: DocTema = JSON.parse(JSON.stringify(t))
  const conflitos: string[] = []
  const nomeParte = (id: string) => origem.parts.find(p => p.id === id)?.name ?? id
  const nomeFace = (id: string) => { const m = origem.molds.find(x => x.faces.some(f => f.id === id)); return m ? `${m.name} (face ${m.faces.findIndex(f => f.id === id) + 1})` : id }
  const remap = <V>(r: Record<string, V> | undefined, mapa: Map<string, string>, nome: (k: string) => string, cheio: (v: V) => boolean = () => true): Record<string, V> => {
    const out: Record<string, V> = {}
    for (const [k, v] of Object.entries(r ?? {})) {
      const [b, suf] = k.split('~')
      const d = mapa.get(b)
      if (d) out[suf ? `${d}~${suf}` : d] = v
      else if (cheio(v)) conflitos.push(nome(k))
    }
    return out
  }
  c.partContent = remap(t.partContent, mp.partes, k => `parte ${nomeParte(k)}`, v => (v as unknown[]).length > 0) as never
  c.faceContent = remap(t.faceContent, mp.faces, k => `face ${nomeFace(k)}`, v => (v as unknown[]).length > 0) as never
  c.localOverrides = Object.fromEntries(Object.entries(remap(t.localOverrides, mp.partes, k => `ajustes da parte ${nomeParte(k)}`)).map(([p, porFace]) => [p, remap(porFace as Record<string, unknown>, mp.faces, k => `ajuste na face ${nomeFace(k)}`)])) as never
  if (t.ordemFace) c.ordemFace = remap(t.ordemFace, mp.faces, () => '', () => false)
  if (t.pecasProntas) c.pecasProntas = remap(t.pecasProntas, mp.moldes, k => `arte pronta da peça ${origem.molds.find(m => m.id === k)?.name ?? k}`) as never
  if (t.paginasProntas) c.paginasProntas = remap(t.paginasProntas, mp.pranchetas, k => `página pronta ${origem.artboards.find(a => a.id === k)?.name ?? k}`)
  if (t.cenarios) c.cenarios = t.cenarios.map(g => g.map(f => mp.faces.get(f)).filter((x): x is string => !!x)).filter(g => g.length >= 2)
  if (t.grupos) c.grupos = t.grupos.filter(g => mp.partes.has(g.parte)).map(g => ({ ...g, parte: mp.partes.get(g.parte)! }))
  // textos: os da base pela variável; os do próprio tema vêm junto (na face equivalente)
  const textosDoTema: DocTrabalho['textSlots'] = []
  for (const s of origem.textSlots.filter(x => x.tema === t.id)) {
    const f = mp.faces.get(s.faceId)
    if (f) textosDoTema.push({ ...JSON.parse(JSON.stringify(s)), faceId: f }); else conflitos.push(`texto ${s.variable} (só deste tema)`)
  }
  const aj: NonNullable<DocTema['textSlotAdjust']> = {}
  for (const [k, v] of Object.entries(t.textSlotAdjust ?? {})) {
    if (textosDoTema.some(s => s.id === k)) { aj[k] = v; continue }
    const d = mp.textos.get(k)
    if (d) aj[d] = v
    else if (!(v as { hidden?: boolean }).hidden) conflitos.push(`ajuste do texto ${origem.textSlots.find(s => s.id === k)?.variable ?? k}`)
  }
  c.textSlotAdjust = aj
  c.baseId = destino.id
  c.baseVersion = destino.version
  return { tema: c, textosDoTema, conflitos: [...new Set(conflitos.filter(Boolean))] }
}
