// mae-render — conversão de unidades. Tudo no modelo é mm; pixels só existem na hora de desenhar.
// REGRA DE PACOTE: sem React/Next/DOM — roda igual na página e num Web Worker.

export const MM_POR_POLEGADA = 25.4
/** Resolução da exportação (impressão). A4 a 300 dpi = 2480 × 3508 px. */
export const DPI_EXPORTACAO = 300
/** Pixel CSS "nominal" (1/96 de polegada) — base da calibração de "tamanho real". */
export const PX_CSS_POR_MM_NOMINAL = 96 / MM_POR_POLEGADA

export const pxPorMm = (dpi: number) => dpi / MM_POR_POLEGADA
export const mmParaPx = (mm: number, dpi: number) => mm * pxPorMm(dpi)
export const pxParaMm = (px: number, dpi: number) => px / pxPorMm(dpi)

/** Tamanho em pixels inteiros de uma folha em mm, na resolução pedida (arredonda como o Photoshop). */
export function tamanhoEmPx(widthMm: number, heightMm: number, dpi: number): { w: number; h: number } {
  return { w: Math.round(mmParaPx(widthMm, dpi)), h: Math.round(mmParaPx(heightMm, dpi)) }
}
