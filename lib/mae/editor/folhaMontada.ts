// Lote 5 (item 76): FOLHA DE IMPRESSÃO MONTADA — várias peças pequenas (rótulos, adesivos, etiquetas) numa folha.
// A PEÇA é um molde da base como outro qualquer (partes, papéis, NOME/IDADE…); a FOLHA é um modelo criado uma vez
// na Base: tamanho, marca de registro (a área dela fica livre) e onde vai cada peça (com giro de 90°).
// Na hora de gerar, a folha vira uma prancheta VIRTUAL com uma cópia de cada peça no lugar dela — a mesma
// exportação de sempre (sobra/arte inteligente de cada peça, linhas, marca, PDF e o SVG/DXF de corte).
// Puro: muda o documento recebido (draft do histórico).
import { organizar, type Ret } from '../apliques/empacotar'
import { tamanhoLocal } from './giroMolde'
import type { DocTema, DocTrabalho, FolhaMontada } from '../schema'

type Doc = DocTrabalho
export type Folha = FolhaMontada
export type PecaNaFolha = Folha['pecas'][number]

const gid = () => 'fm_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3)
export const folhasDa = (d: Pick<Doc, 'folhas'>): Folha[] => d.folhas ?? []

export function criarFolha(d: Doc, p: { nome: string; widthMm: number; heightMm: number; registrationPresetId?: string; registrationPresetSha?: string }): string {
  const id = gid()
  ;(d.folhas ??= []).push({ id, nome: p.nome.trim().slice(0, 80) || 'Folha', widthMm: p.widthMm, heightMm: p.heightMm, espacoMm: 2, margemMm: 5, pecas: [],
    ...(p.registrationPresetId ? { registrationPresetId: p.registrationPresetId } : {}), ...(p.registrationPresetSha ? { registrationPresetSha: p.registrationPresetSha } : {}) })
  return id
}
export function excluirFolha(d: Doc, id: string): void {
  d.folhas = folhasDa(d).filter(f => f.id !== id)
  for (const g of d.grupos ?? []) if (g.folhaId === id) delete g.folhaId
  if (!d.folhas.length) delete d.folhas
}

/** Tamanho da peça na folha (90° troca largura e altura). */
export function tamanhoPeca(m: Pick<Doc['molds'][number], 'source'>, rot: 0 | 90): { w: number; h: number } {
  const { w, h } = tamanhoLocal(m)
  return rot === 90 ? { w: h, h: w } : { w, h }
}

/**
 * Organiza a lista de peças pedidas (molde × quantidade) na folha, com o espaço e a margem dela, fora das zonas
 * da marca. Cada tipo de peça testa em pé e deitada (a que couber mais). `quantidade` ausente = o máximo que cabe.
 * Devolve as peças colocadas e quantas ficaram de fora.
 */
export function organizarFolha(f: Pick<Folha, 'widthMm' | 'heightMm' | 'espacoMm' | 'margemMm'>, pedidas: { moldeId: string; quantidade?: number }[], moldes: Doc['molds'], obstaculos: Ret[] = []): { pecas: PecaNaFolha[]; ficaram: number } {
  const tipos = pedidas.map(p => ({ ...p, m: moldes.find(m => m.id === p.moldeId) })).filter(p => p.m)
  const tentar = (rots: (0 | 90)[]) => {
    const lista: { id: string; w: number; h: number }[] = []
    tipos.forEach((t, k) => {
      const { w, h } = tamanhoPeca(t.m!, rots[k])
      const n = t.quantidade ?? Math.ceil(((f.widthMm * f.heightMm) / Math.max(1, w * h)) + 1)
      for (let i = 0; i < n; i++) lista.push({ id: `${k}:${i}`, w, h })
    })
    const r = organizar(lista, f.widthMm, f.heightMm, { espacoMm: f.espacoMm, margemMm: f.margemMm, obstaculos })
    return { r, rots }
  }
  // escolhe, tipo a tipo, a orientação que coloca mais peças (poucos tipos: testa as combinações)
  const combos: (0 | 90)[][] = []
  const n = Math.min(tipos.length, 4)
  for (let mask = 0; mask < 1 << n; mask++) combos.push(tipos.map((_, k) => (k < n && (mask >> k) & 1 ? 90 : 0)))
  let melhor = tentar(combos[0])
  for (const c of combos.slice(1)) { const x = tentar(c); if (x.r.colocadas.length > melhor.r.colocadas.length) melhor = x }
  const pecas = melhor.r.colocadas.map(c => { const k = Number(c.id.split(':')[0]); return { moldeId: tipos[k].moldeId, xMm: round(c.x), yMm: round(c.y), rot: melhor.rots[k] } })
  const pedidasTotal = tipos.reduce((s, t) => s + (t.quantidade ?? 0), 0)
  return { pecas, ficaram: tipos.every(t => t.quantidade !== undefined) ? Math.max(0, pedidasTotal - pecas.length) : 0 }
}
const round = (v: number) => Math.round(v * 100) / 100

/** "38 peças · 87% da folha usada". */
export function aproveitamento(f: Pick<Folha, 'widthMm' | 'heightMm' | 'pecas'>, moldes: Doc['molds']): { pecas: number; pct: number } {
  const area = f.pecas.reduce((s, p) => { const m = moldes.find(x => x.id === p.moldeId); if (!m) return s; const t = tamanhoPeca(m, p.rot as 0 | 90); return s + t.w * t.h }, 0)
  return { pecas: f.pecas.length, pct: Math.round((area / Math.max(1, f.widthMm * f.heightMm)) * 100) }
}

/** Peças que se sobrepõem (aviso no ajuste manual). */
export function sobrepostas(f: Pick<Folha, 'pecas'>, moldes: Doc['molds']): number[] {
  const rs = f.pecas.map(p => { const m = moldes.find(x => x.id === p.moldeId); const t = m ? tamanhoPeca(m, p.rot as 0 | 90) : { w: 0, h: 0 }; return { x: p.xMm, y: p.yMm, w: t.w, h: t.h } })
  const out: number[] = []
  rs.forEach((a, i) => { if (rs.some((b, j) => j !== i && a.x < b.x + b.w - 0.01 && a.x + a.w > b.x + 0.01 && a.y < b.y + b.h - 0.01 && a.y + a.h > b.y + 0.01)) out.push(i) })
  return out
}

/**
 * A folha como PRANCHETA VIRTUAL para a exportação: uma cópia de cada peça (molde com faces, identidade e as
 * posições de texto, ids `…~k`) no lugar e giro dela, com a marca da folha. O tema ganha as mesmas cópias do que
 * é por face (conteúdo só da caixa, ajustes locais, ajuste do texto). As partes valem para todas as cópias.
 */
export function docDaFolha(base: Doc, tema: DocTema, f: Folha): { doc: Doc; tema: DocTema; artboardId: string } {
  const abId = `folha_${f.id}`
  const t: DocTema = JSON.parse(JSON.stringify(tema))
  const molds: Doc['molds'] = []
  const textSlots: Doc['textSlots'] = []
  const parts: Doc['parts'] = base.parts.map(p => ({ ...p, instances: [...p.instances] }))
  f.pecas.forEach((p, k) => {
    const m = base.molds.find(x => x.id === p.moldeId)
    if (!m) return
    const fid = (id: string) => `${id}~${k}`
    molds.push({ ...m, id: `${m.id}~${k}`, artboardId: abId, transform: { xMm: p.xMm, yMm: p.yMm, rotationDeg: p.rot },
      faces: m.faces.map(fc => ({ ...fc, id: fid(fc.id) })) })
    for (const parte of parts) for (const inst of parte.instances.filter(i => m.faces.some(fc => fc.id === i.faceId))) parte.instances.push({ ...inst, faceId: fid(inst.faceId) })
    for (const s of base.textSlots.filter(s => m.faces.some(fc => fc.id === s.faceId))) {
      textSlots.push({ ...s, id: fid(s.id), faceId: fid(s.faceId) })
      if (t.textSlotAdjust?.[s.id]) t.textSlotAdjust[fid(s.id)] = t.textSlotAdjust[s.id]
    }
    for (const fc of m.faces) {
      if (t.faceContent?.[fc.id]) t.faceContent[fid(fc.id)] = t.faceContent[fc.id]
      if (t.localOverrides?.[fc.id]) t.localOverrides[fid(fc.id)] = t.localOverrides[fc.id]
    }
  })
  const ab = { id: abId, widthMm: f.widthMm, heightMm: f.heightMm, name: f.nome,
    ...(f.registrationPresetId ? { registrationPresetId: f.registrationPresetId } : {}), ...(f.registrationPresetSha ? { registrationPresetSha: f.registrationPresetSha } : {}) }
  return { doc: { ...base, artboards: [ab], molds, parts, textSlots, grupos: undefined, folhas: undefined }, tema: t, artboardId: abId }
}
