// Lote 4 (item 52): REPLICAR NOME, IDADE e HASHTAG entre as páginas (Tema pronto) e as caixas (base).
// A posição de texto é relativa à FACE (box em 0–1), então copiar para outra face/prancheta mantém a mesma
// posição relativa. Todas as cópias usam a MESMA variável — e, no tema, o mesmo estilo (textStyles[VAR]);
// "Só nesta caixa" continua por posição (textSlotAdjust). Puro: muda o documento recebido (draft do histórico).
import type { DocTrabalho } from '../schema'
import { area, type Pt } from '../faces/geometria'

type Doc = DocTrabalho
export type PosicaoTexto = Doc['textSlots'][number]

const r3 = (x: number) => Math.round(x * 1000) / 1000
export const novoIdPosicao = (variavel: string) => `ts_${variavel.toLowerCase().replace(/[^a-z0-9]+/g, '')}_${Math.random().toString(36).slice(2, 8)}`

/** Padrão de cada variável (como o Tema pronto cria na 1ª página). */
const PADRAO: Record<string, { box: { x: number; y: number; w: number; h: number }; sizePt: number }> = {
  NOME: { box: { x: 0.1, y: 0.38, w: 0.8, h: 0.16 }, sizePt: 36 },
  IDADE: { box: { x: 0.3, y: 0.56, w: 0.4, h: 0.1 }, sizePt: 24 },
  HASHTAG: { box: { x: 0.12, y: 0.84, w: 0.76, h: 0.07 }, sizePt: 14 },
  ARROBA: { box: { x: 0.25, y: 0.9, w: 0.5, h: 0.06 }, sizePt: 12 },
}

/** A face principal de uma prancheta (a maior, sem furo) — onde o texto entra. */
export function faceDaPrancheta(d: Doc, artboardId: string): string | null {
  let melhor: { id: string; a: number } | null = null
  for (const m of d.molds) {
    if (m.artboardId !== artboardId) continue
    for (const f of m.faces) {
      if (f.hole) continue
      const a = area(f.polygonMm as Pt[])
      if (!melhor || a > melhor.a) melhor = { id: f.id, a }
    }
  }
  return melhor?.id ?? null
}

/** Prancheta de uma face. */
export function pranchetaDaFace(d: Doc, faceId: string): string | null {
  return d.molds.find(m => m.faces.some(f => f.id === faceId))?.artboardId ?? null
}

/**
 * Lote 5 (item 56): fator para manter o tamanho da caixa em MM ao trocar de face (a caixa é fração da face:
 * numa face menor, a mesma fração encolhia o texto até virar uma caixinha "revise").
 */
export interface EscalaFaces { kx: number; ky: number }
function reescalar(c: PosicaoTexto, e?: EscalaFaces) {
  if (!e || !Number.isFinite(e.kx) || !Number.isFinite(e.ky) || e.kx <= 0 || e.ky <= 0) return
  c.box.w = r3(Math.min(2, Math.max(0.02, c.box.w * e.kx)))
  c.box.h = r3(Math.min(2, Math.max(0.02, c.box.h * e.ky)))
}

/** Cópia da posição numa face (mesmo estilo/tamanho/giro, id novo); `centro` (0–1 da face) reposiciona. */
export function copiaDaPosicao(s: PosicaoTexto, faceId: string, centro?: { u: number; v: number }, escala?: EscalaFaces): PosicaoTexto {
  const c: PosicaoTexto = JSON.parse(JSON.stringify(s))
  c.id = novoIdPosicao(s.variable)
  c.faceId = faceId
  reescalar(c, escala)
  if (centro) { c.box.x = r3(centro.u - c.box.w / 2); c.box.y = r3(centro.v - c.box.h / 2) }
  return c
}

/**
 * "Colocar em todas as páginas": cria a mesma posição (mesma variável, posição relativa, tamanho e giro) em
 * TODAS as outras pranchetas que têm face e ainda não têm essa variável. Devolve quantas criou.
 */
export function colocarEmTodas(d: Doc, slotId: string): number {
  const s = d.textSlots.find(t => t.id === slotId)
  if (!s) return 0
  const origem = pranchetaDaFace(d, s.faceId)
  let n = 0
  for (const ab of d.artboards) {
    if (ab.id === origem) continue
    const face = faceDaPrancheta(d, ab.id)
    if (!face) continue
    const jaTem = d.textSlots.some(t => t.variable === s.variable && pranchetaDaFace(d, t.faceId) === ab.id)
    if (jaTem) continue
    d.textSlots.push(copiaDaPosicao(s, face))
    n++
  }
  return n
}

/**
 * "+ NOME · + IDADE · + HASHTAG" numa prancheta: copia a posição dessa variável que já existe em outra página
 * (mesma posição relativa e tamanho); se ainda não existe, usa o padrão. Devolve o id criado (ou o existente).
 */
export function adicionarNaPrancheta(d: Doc, artboardId: string, variavel: string): string | null {
  const face = faceDaPrancheta(d, artboardId)
  if (!face) return null
  const ja = d.textSlots.find(t => t.variable === variavel && pranchetaDaFace(d, t.faceId) === artboardId)
  if (ja) return ja.id
  const modelo = d.textSlots.find(t => t.variable === variavel)
  if (modelo) { const c = copiaDaPosicao(modelo, face); d.textSlots.push(c); return c.id }
  const p = PADRAO[variavel] ?? PADRAO.NOME
  const id = novoIdPosicao(variavel)
  d.textSlots.push({ id, variable: variavel, faceId: face, box: { ...p.box }, single: { lines: 1, sizePt: p.sizePt },
    compound: { lines: 2, sizePt: Math.round(p.sizePt * 0.8), lineHeight: 0.9 }, autoFit: { minScale: 0.6 } } as PosicaoTexto)
  return id
}

/** Ctrl+J / Alt + arrastar: duplica a posição (na mesma face, um pouco abaixo; ou na face/centro dados). */
export function duplicarPosicao(d: Doc, slotId: string, alvo?: { faceId: string; centro: { u: number; v: number }; escala?: EscalaFaces }): string | null {
  const s = d.textSlots.find(t => t.id === slotId)
  if (!s) return null
  const c = alvo ? copiaDaPosicao(s, alvo.faceId, alvo.centro, alvo.escala)
    : copiaDaPosicao(s, s.faceId, { u: s.box.x + s.box.w / 2, v: Math.min(0.95, s.box.y + s.box.h / 2 + Math.max(0.05, s.box.h * 0.6)) })
  d.textSlots.push(c)
  return c.id
}

/** Arrastar para OUTRA prancheta/face: a posição muda de face, com o centro onde soltou. */
export function moverParaFace(d: Doc, slotId: string, faceId: string, centro: { u: number; v: number }, escala?: EscalaFaces): void {
  const s = d.textSlots.find(t => t.id === slotId)
  if (!s) return
  if (s.faceId !== faceId) reescalar(s, escala)
  s.faceId = faceId
  s.box.x = r3(centro.u - s.box.w / 2)
  s.box.y = r3(centro.v - s.box.h / 2)
}

/** Ctrl+V: cola a posição copiada na prancheta escolhida (mesma posição relativa). */
export function colarNaPrancheta(d: Doc, copiada: PosicaoTexto, artboardId: string): string | null {
  const face = faceDaPrancheta(d, artboardId)
  if (!face) return null
  const c = copiaDaPosicao(copiada, face)
  // colar na mesma face de onde copiou: um pouco abaixo, para não ficar exatamente por cima
  if (face === copiada.faceId) { c.box.y = r3(Math.min(0.95 - c.box.h, c.box.y + Math.max(0.05, c.box.h * 0.6))) }
  d.textSlots.push(c)
  return c.id
}
