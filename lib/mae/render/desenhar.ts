// mae-render — O MOTOR ÚNICO de desenho. A mesma função desenha na TELA (dentro do Konva) e no
// ARQUIVO FINAL (exportação, Sprint 9; Worker com OffscreenCanvas, Sprint 2). Nunca criar outro
// caminho de desenho para a arte.
//
// Convenção: quem chama já deixou o contexto transformado para que 1 unidade = 1 mm
// (no Konva, a escala do palco; na exportação, ctx.scale(pxPorMm(300))). Por isso aqui tudo é mm.
// `pxPorMmDoDispositivo` só serve para linhas "finas de tela" (borda, grade) não engrossarem no zoom.
import type { Prancheta } from '../schema/prancheta'

export type Contexto2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export interface OpcoesPrancheta {
  /** Pixels do dispositivo por mm no contexto atual (para espessura de linha constante na tela). */
  pxPorMmDoDispositivo: number
  /** Desenhar a grade em mm (só na tela; a exportação passa `false`). */
  grade?: false | { passoMm: number }
  /** Borda da folha (só na tela). */
  borda?: boolean
  corFundo?: string
}

/** Desenha uma prancheta vazia com origem em (0, 0) mm. */
export function desenharPrancheta(ctx: Contexto2D, p: Pick<Prancheta, 'widthMm' | 'heightMm'>, o: OpcoesPrancheta): void {
  const fino = 1 / Math.max(o.pxPorMmDoDispositivo, 1e-6)   // 1 px do dispositivo, em mm
  ctx.save()
  ctx.fillStyle = o.corFundo ?? '#ffffff'
  ctx.fillRect(0, 0, p.widthMm, p.heightMm)

  if (o.grade && o.grade.passoMm > 0) {
    const passo = o.grade.passoMm
    ctx.beginPath()
    for (let x = passo; x < p.widthMm; x += passo) { ctx.moveTo(x, 0); ctx.lineTo(x, p.heightMm) }
    for (let y = passo; y < p.heightMm; y += passo) { ctx.moveTo(0, y); ctx.lineTo(p.widthMm, y) }
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)'
    ctx.lineWidth = fino
    ctx.stroke()
  }

  if (o.borda !== false) {
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)'
    ctx.lineWidth = fino
    ctx.strokeRect(fino / 2, fino / 2, p.widthMm - fino, p.heightMm - fino)
  }
  ctx.restore()
}

/** Passo da grade adequado ao zoom: linhas a pelo menos ~8 px de distância na tela. */
export function passoDaGrade(pxPorMmTela: number): number {
  for (const passo of [1, 2, 5, 10, 20, 50, 100]) if (passo * pxPorMmTela >= 8) return passo
  return 100
}
