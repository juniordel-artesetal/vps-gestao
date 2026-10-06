// PRANCHETAS LIVRES NA ÁREA DE TRABALHO (Lote 1, itens 10–12) — puro (sem tela): posição salva na base,
// ímã para alinhar nas outras, "Organizar" (linha, coluna, grade), girar (retrato ↔ paisagem),
// redimensionar, duplicar (com os moldes) e excluir (com os moldes). Tudo passa pelo histórico na tela.
import type { DocTrabalho } from '../schema'

type Doc = DocTrabalho
type Ab = Doc['artboards'][number]
export interface Pos { xMm: number; yMm: number }
export const ESPACO_MM = 20

/**
 * Posição de cada prancheta: a salva na base (xMm/yMm) ou, sem ela, a fila antiga (lado a lado, 20 mm de
 * espaço, depois da mais à direita) — bases antigas abrem igual a antes.
 */
export function posicoesPranchetas(abs: { widthMm: number; heightMm: number; xMm?: number; yMm?: number }[]): Pos[] {
  let direita = -ESPACO_MM
  for (const a of abs) if (a.xMm !== undefined) direita = Math.max(direita, a.xMm + a.widthMm)
  return abs.map(a => {
    if (a.xMm !== undefined && a.yMm !== undefined) return { xMm: a.xMm, yMm: a.yMm }
    const p = { xMm: direita + ESPACO_MM, yMm: 0 }
    direita = p.xMm + a.widthMm
    return p
  })
}

/** Retângulo que envolve todas as pranchetas (para "Ajustar à tela"). */
export function limitesPranchetas(abs: { widthMm: number; heightMm: number; xMm?: number; yMm?: number }[]) {
  const ps = posicoesPranchetas(abs)
  if (!abs.length) return { xMm: 0, yMm: 0, wMm: 1, hMm: 1 }
  const x0 = Math.min(...ps.map(p => p.xMm)), y0 = Math.min(...ps.map(p => p.yMm))
  const x1 = Math.max(...abs.map((a, i) => ps[i].xMm + a.widthMm)), y1 = Math.max(...abs.map((a, i) => ps[i].yMm + a.heightMm))
  return { xMm: x0, yMm: y0, wMm: x1 - x0, hMm: y1 - y0 }
}

/**
 * ÍMÃ: encosta a prancheta arrastada nas bordas/centros das outras (e nas bordas com o espaço padrão),
 * quando chega a menos de `tolMm`. Cada eixo independente.
 */
export function imaPrancheta(p: Pos, w: number, h: number, outras: { xMm: number; yMm: number; wMm: number; hMm: number }[], tolMm: number): Pos & { guiaX?: number; guiaY?: number } {
  let melhorX: { d: number; x: number; guia: number } | null = null, melhorY: { d: number; y: number; guia: number } | null = null
  for (const o of outras) {
    const alvosX = [o.xMm, o.xMm + o.wMm, o.xMm + o.wMm / 2, o.xMm + o.wMm + ESPACO_MM, o.xMm - ESPACO_MM]
    const meusX = [[p.xMm, 0], [p.xMm + w, w], [p.xMm + w / 2, w / 2]] as const
    for (const ax of alvosX) for (const [mx, off] of meusX) {
      const d = Math.abs(mx - ax)
      if (d <= tolMm && (!melhorX || d < melhorX.d)) melhorX = { d, x: ax - off, guia: ax }
    }
    const alvosY = [o.yMm, o.yMm + o.hMm, o.yMm + o.hMm / 2, o.yMm + o.hMm + ESPACO_MM, o.yMm - ESPACO_MM]
    const meusY = [[p.yMm, 0], [p.yMm + h, h], [p.yMm + h / 2, h / 2]] as const
    for (const ay of alvosY) for (const [my, off] of meusY) {
      const d = Math.abs(my - ay)
      if (d <= tolMm && (!melhorY || d < melhorY.d)) melhorY = { d, y: ay - off, guia: ay }
    }
  }
  return { xMm: melhorX ? melhorX.x : p.xMm, yMm: melhorY ? melhorY.y : p.yMm, ...(melhorX ? { guiaX: melhorX.guia } : {}), ...(melhorY ? { guiaY: melhorY.guia } : {}) }
}

export type ModoOrganizar = 'linha' | 'coluna' | 'grade'
/** "Organizar": em linha, em coluna ou em grade (colunas ≈ √n), com 20 mm entre elas. Grava xMm/yMm. */
export function organizarPranchetas(d: Doc, modo: ModoOrganizar): void {
  const n = d.artboards.length
  const cols = modo === 'linha' ? n : modo === 'coluna' ? 1 : Math.ceil(Math.sqrt(n))
  const largCol: number[] = [], altLin: number[] = []
  d.artboards.forEach((a, i) => {
    const c = i % cols, l = Math.floor(i / cols)
    largCol[c] = Math.max(largCol[c] ?? 0, a.widthMm); altLin[l] = Math.max(altLin[l] ?? 0, a.heightMm)
  })
  d.artboards.forEach((a, i) => {
    const c = i % cols, l = Math.floor(i / cols)
    a.xMm = largCol.slice(0, c).reduce((s, x) => s + x + ESPACO_MM, 0)
    a.yMm = altLin.slice(0, l).reduce((s, x) => s + x + ESPACO_MM, 0)
  })
}

/** Grava as posições atuais (fila antiga) em todas — antes de mover uma, para as outras não "pularem". */
export function fixarPosicoes(d: Doc): void {
  const ps = posicoesPranchetas(d.artboards)
  d.artboards.forEach((a, i) => { if (a.xMm === undefined || a.yMm === undefined) { a.xMm = ps[i].xMm; a.yMm = ps[i].yMm } })
}

/** Moldes que ficaram (parte) fora da folha — aviso depois de girar/redimensionar (os moldes não se mexem). */
export function moldesForaDaPrancheta(d: Doc, abId: string): string[] {
  const a = d.artboards.find(x => x.id === abId)
  if (!a) return []
  return d.molds.filter(m => m.artboardId === abId && (m.transform.xMm < -0.01 || m.transform.yMm < -0.01 || m.transform.xMm + m.source.widthMm > a.widthMm + 0.01 || m.transform.yMm + (m.source.heightMm ?? m.source.widthMm) > a.heightMm + 0.01)).map(m => m.name)
}

/** Girar: retrato ↔ paisagem (troca largura e altura em volta do centro da prancheta). */
export function girarPrancheta(d: Doc, abId: string): void {
  const a = d.artboards.find(x => x.id === abId)
  if (!a) return
  const ps = posicoesPranchetas(d.artboards)[d.artboards.indexOf(a)]
  const [w, h] = [a.heightMm, a.widthMm]
  a.xMm = Math.round((ps.xMm + (a.widthMm - w) / 2) * 100) / 100
  a.yMm = Math.round((ps.yMm + (a.heightMm - h) / 2) * 100) / 100
  a.widthMm = w; a.heightMm = h
}

export function redimensionarPrancheta(d: Doc, abId: string, wMm: number, hMm: number): void {
  const a = d.artboards.find(x => x.id === abId)
  if (!a || !(wMm > 0 && hMm > 0)) return
  a.widthMm = wMm; a.heightMm = hMm
}

const gid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`

/**
 * Duplicar com os moldes: prancheta nova à direita de todas; moldes copiados (ids novos, faces renomeadas),
 * e as faces copiadas entram nas MESMAS partes e com as mesmas posições de texto — a cópia já sai vinculada.
 */
export function duplicarPrancheta(d: Doc, abId: string): string | null {
  const a = d.artboards.find(x => x.id === abId)
  if (!a) return null
  fixarPosicoes(d)
  const lim = limitesPranchetas(d.artboards)
  const novo: Ab = { ...JSON.parse(JSON.stringify(a)), id: gid('ab'), xMm: lim.xMm + lim.wMm + ESPACO_MM, yMm: a.yMm ?? 0, ...(a.name ? { name: `${a.name} (cópia)` } : {}) }
  // camadas do editor livre: ids novos (a seleção acha a camada pelo id)
  const renumerar = (ls: { id: string; children?: unknown[] }[] | undefined) => { for (const l of ls ?? []) { l.id = gid('ly'); renumerar(l.children as never) } }
  renumerar(novo.layers as never)
  d.artboards.push(novo)
  const mapaFace = new Map<string, string>()
  for (const m of d.molds.filter(x => x.artboardId === abId)) {
    const id = gid('m')
    const c = JSON.parse(JSON.stringify(m)) as typeof m
    c.id = id; c.artboardId = novo.id
    for (const f of c.faces) { const n = f.id.replace(`f_${m.id}_`, `f_${id}_`); mapaFace.set(f.id, n === f.id ? `${f.id}_${id}` : n); f.id = mapaFace.get(f.id)! }
    d.molds.push(c)
  }
  for (const p of d.parts) for (const inst of [...p.instances]) if (mapaFace.has(inst.faceId)) p.instances.push({ ...JSON.parse(JSON.stringify(inst)), faceId: mapaFace.get(inst.faceId)! })
  for (const t of [...d.textSlots]) if (mapaFace.has(t.faceId)) d.textSlots.push({ ...JSON.parse(JSON.stringify(t)), id: gid('ts'), faceId: mapaFace.get(t.faceId)! })
  return novo.id
}

/** Excluir a prancheta e os moldes dela (e o que apontava para as faces deles). Não exclui a última. */
export function excluirPrancheta(d: Doc, abId: string): boolean {
  if (d.artboards.length <= 1 || !d.artboards.some(a => a.id === abId)) return false
  fixarPosicoes(d)
  const faces = new Set(d.molds.filter(m => m.artboardId === abId).flatMap(m => m.faces.map(f => f.id)))
  d.artboards = d.artboards.filter(a => a.id !== abId)
  d.molds = d.molds.filter(m => m.artboardId !== abId)
  for (const p of d.parts) p.instances = p.instances.filter(i => !faces.has(i.faceId))
  d.textSlots = d.textSlots.filter(t => !faces.has(t.faceId))
  return true
}
