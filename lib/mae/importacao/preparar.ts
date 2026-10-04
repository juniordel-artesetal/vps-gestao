// mae-importação — do raster da página/arquivo ao MOLDE PREPARADO: binariza, acha o desenho, recorta
// com margem (o fundo precisa contornar o molde) e alinha a máscara de dobras na mesma grade.
// Puro (sem DOM): recebe o RGBA já desenhado.
import { binarizar, caixaDaLinha, recortar, type Mascara } from '../faces/raster'
import type { Pt } from '../faces/geometria'

/** Resolução da detecção de faces (spec: ~200 dpi). */
export const DPI_DETECCAO = 200
export const PX_POR_MM_DETECCAO = DPI_DETECCAO / 25.4

export interface RecorteMm { xMm: number; yMm: number; wMm: number; hMm: number }

export interface MoldePreparado {
  linhas: Mascara
  dobras: Mascara | null
  /** Recorte do molde dentro da página/arquivo, em mm (o que a receita guarda). */
  recorte: RecorteMm
  pxPorMm: number
}

const r3 = (v: number) => Math.round(v * 1000) / 1000

/** Traça polilinhas (mm) numa máscara (1 px de espessura), deslocadas pela origem do recorte. */
export function tracarPolilinhas(m: Mascara, polis: Pt[][], pxPorMm: number, origemMm: [number, number] = [0, 0]): void {
  const marca = (x: number, y: number) => { if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.d[y * m.w + x] = 1 }
  for (const p of polis) for (let i = 0; i + 1 < p.length; i++) {
    const x0 = (p[i][0] - origemMm[0]) * pxPorMm, y0 = (p[i][1] - origemMm[1]) * pxPorMm
    const x1 = (p[i + 1][0] - origemMm[0]) * pxPorMm, y1 = (p[i + 1][1] - origemMm[1]) * pxPorMm
    const passos = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2))
    for (let s = 0; s <= passos; s++) marca(Math.floor(x0 + ((x1 - x0) * s) / passos), Math.floor(y0 + ((y1 - y0) * s) / passos))
  }
}

/**
 * RGBA da página inteira (na escala pxPorMm) → molde preparado. O recorte é a caixa do desenho + margem
 * (padrão 3 mm), alinhada aos pixels. `dobrasMm` = linhas tracejadas em mm da página (PDF);
 * `dobrasRgba` = a mesma página desenhada só com as tracejadas (SVG/DXF).
 */
export function prepararDeRaster(rgba: Uint8ClampedArray, w: number, h: number, pxPorMm: number,
  o: { limiar?: number; margemMm?: number; dobrasMm?: Pt[][]; dobrasRgba?: Uint8ClampedArray | null } = {}): MoldePreparado | null {
  const cheia = binarizar(rgba, w, h, o.limiar ?? 200)
  const cx = caixaDaLinha(cheia)
  if (!cx) return null
  const mg = Math.round((o.margemMm ?? 3) * pxPorMm)
  const x = cx.x0 - mg, y = cx.y0 - mg
  const rw = cx.x1 - cx.x0 + 1 + 2 * mg, rh = cx.y1 - cx.y0 + 1 + 2 * mg
  const linhas = recortar(cheia, x, y, rw, rh)
  let dobras: Mascara | null = null
  if (o.dobrasMm?.length) {
    dobras = { w: rw, h: rh, d: new Uint8Array(rw * rh) }
    tracarPolilinhas(dobras, o.dobrasMm, pxPorMm, [x / pxPorMm, y / pxPorMm])
  } else if (o.dobrasRgba) {
    const d = binarizar(o.dobrasRgba, w, h, 230)
    dobras = recortar(d, x, y, rw, rh)
    if (!dobras.d.some(v => v)) dobras = null
  }
  return { linhas, dobras, pxPorMm, recorte: { xMm: r3(x / pxPorMm), yMm: r3(y / pxPorMm), wMm: r3(rw / pxPorMm), hMm: r3(rh / pxPorMm) } }
}
