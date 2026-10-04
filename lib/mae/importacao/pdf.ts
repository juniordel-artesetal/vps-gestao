// mae-importação — PDF (pdf.js). Rasteriza a página para a detecção de faces e lê os VETORES (para
// conferir a escala e achar as linhas tracejadas = dobra). O arquivo original fica na Biblioteca: na
// exportação (Sprint 9) as linhas saem do vetor, não deste raster.
// Recebe o módulo do pdf.js por parâmetro: no navegador vem 'pdfjs-dist', nos testes o build "legacy".
import type { Pt } from '../faces/geometria'

export const MM_POR_PT = 25.4 / 72

/* eslint-disable @typescript-eslint/no-explicit-any */
type PdfJs = { getDocument: (o: any) => { promise: Promise<any> }; OPS: Record<string, number> }
export type PaginaPdf = { getViewport: (o: { scale: number }) => { width: number; height: number; transform: number[] }; getOperatorList: () => Promise<{ fnArray: number[]; argsArray: any[] }>; render: (o: any) => { promise: Promise<void> } }

export async function abrirPdf(pdfjs: PdfJs, dados: Uint8Array): Promise<{ paginas: number; pagina: (n: number) => Promise<PaginaPdf> }> {
  const doc = await pdfjs.getDocument({ data: dados, isEvalSupported: false, disableFontFace: true }).promise
  return { paginas: doc.numPages, pagina: (n: number) => doc.getPage(n) }
}

export function tamanhoPaginaMm(p: PaginaPdf): { larguraMm: number; alturaMm: number } {
  const v = p.getViewport({ scale: 1 })
  return { larguraMm: v.width * MM_POR_PT, alturaMm: v.height * MM_POR_PT }
}

/**
 * Desenha a página inteira em `ctx` (fundo branco) na escala pxPorMm. Traço tracejado sai CONTÍNUO
 * (a dobra é anotada à parte pelos vetores), senão o pontilhado quebraria as regiões.
 */
export async function desenharPagina(p: PaginaPdf, ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, pxPorMm: number): Promise<void> {
  const viewport = p.getViewport({ scale: pxPorMm * MM_POR_PT })
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, Math.ceil(viewport.width), Math.ceil(viewport.height))
  const original = ctx.setLineDash
  ;(ctx as { setLineDash: (s: number[]) => void }).setLineDash = () => {}
  try {
    await p.render({ canvasContext: ctx, viewport, background: 'rgba(255,255,255,1)' }).promise
  } finally {
    ;(ctx as { setLineDash: typeof original }).setLineDash = original
    ctx.restore()
  }
}

type M = [number, number, number, number, number, number]
const mult = (a: M, b: M): M => [
  a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
]
const aplica = (m: M, x: number, y: number): Pt => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

export interface VetoresPdf {
  /** Todas as linhas traçadas (polilinhas em mm, origem no canto superior esquerdo da PÁGINA). */
  linhas: Pt[][]
  /** As traçadas com tracejado ativo (= dobra). */
  dobras: Pt[][]
}

/** Lê os caminhos traçados da página (curvas achatadas em 8 trechos), já em mm de página. */
export async function vetoresDaPagina(p: PaginaPdf, OPS: Record<string, number>): Promise<VetoresPdf> {
  const { fnArray, argsArray } = await p.getOperatorList()
  const vp = p.getViewport({ scale: MM_POR_PT }).transform as M
  let ctm: M = [1, 0, 0, 1, 0, 0]
  const pilha: { ctm: M; tracejado: boolean }[] = []
  let tracejado = false
  let caminho: Pt[][] = []
  const linhas: Pt[][] = [], dobras: Pt[][] = []
  const mm = (x: number, y: number) => aplica(mult(vp, ctm), x, y)
  const tracar = () => { for (const c of caminho) if (c.length > 1) (tracejado ? dobras : linhas).push(c); caminho = [] }
  for (let i = 0; i < fnArray.length; i++) {
    const f = fnArray[i], a = argsArray[i]
    if (f === OPS.save) pilha.push({ ctm, tracejado })
    else if (f === OPS.restore) { const s = pilha.pop(); if (s) { ctm = s.ctm; tracejado = s.tracejado } }
    else if (f === OPS.transform) ctm = mult(ctm, a as M)
    else if (f === OPS.setDash) tracejado = Array.isArray(a?.[0]) && a[0].some((v: number) => v > 0)
    else if (f === OPS.constructPath) {
      const ops: number[] = a[0], args: number[] = a[1]
      let k = 0, atual: Pt = [0, 0], inicio: Pt = [0, 0]
      let sub: Pt[] = []
      const fecha = () => { if (sub.length > 1) caminho.push(sub); sub = [] }
      for (const op of ops) {
        if (op === OPS.moveTo) { fecha(); atual = [args[k++], args[k++]]; inicio = atual; sub = [mm(...atual)] }
        else if (op === OPS.lineTo) { atual = [args[k++], args[k++]]; sub.push(mm(...atual)) }
        else if (op === OPS.curveTo || op === OPS.curveTo2 || op === OPS.curveTo3) {
          let c1: Pt, c2: Pt, fim: Pt
          if (op === OPS.curveTo) { c1 = [args[k++], args[k++]]; c2 = [args[k++], args[k++]]; fim = [args[k++], args[k++]] }
          else if (op === OPS.curveTo2) { c1 = atual; c2 = [args[k++], args[k++]]; fim = [args[k++], args[k++]] }
          else { c1 = [args[k++], args[k++]]; fim = [args[k++], args[k++]]; c2 = fim }
          for (let s = 1; s <= 8; s++) {
            const t = s / 8, u = 1 - t
            const x = u * u * u * atual[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * fim[0]
            const y = u * u * u * atual[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * fim[1]
            sub.push(mm(x, y))
          }
          atual = fim
        } else if (op === OPS.closePath) { if (sub.length) sub.push(sub[0]); atual = inicio }
        else if (op === OPS.rectangle) {
          fecha()
          const x = args[k++], y = args[k++], w = args[k++], h = args[k++]
          caminho.push([mm(x, y), mm(x + w, y), mm(x + w, y + h), mm(x, y + h), mm(x, y)])
        }
      }
      fecha()
    } else if (f === OPS.stroke || f === OPS.closeStroke || f === OPS.fillStroke || f === OPS.closeFillStroke || f === OPS.eoFillStroke || f === OPS.closeEOFillStroke) tracar()
    else if (f === OPS.endPath || f === OPS.fill || f === OPS.eoFill) caminho = []
  }
  return { linhas, dobras }
}
