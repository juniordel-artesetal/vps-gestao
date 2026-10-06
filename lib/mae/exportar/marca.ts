// mae-exportar — MARCA DE REGISTRO (print & cut): onde a marca tem tinta (zonas proibidas para a arte) e
// como a prancheta encaixa na folha da marca (igual, girada 90° ou tamanho diferente → alerta). Puro.
import { intersectD, unionD, FillRule, type PathsD } from 'clipper2-ts'
import { area, type Pt } from '../faces/geometria'

export interface Zona { x: number; y: number; w: number; h: number }

/**
 * Zonas escuras da marca (mm), a partir do RGBA dela rasterizada: células de 1 mm com tinta → grupos
 * conectados → caixas, com `folgaMm` de respiro (a câmera da Silhouette precisa de branco em volta).
 */
export function zonasDaMarca(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, pxPorMm: number, folgaMm = 2, limiar = 160): Zona[] {
  const cw = Math.ceil(w / pxPorMm), ch = Math.ceil(h / pxPorMm)
  const cel = new Uint8Array(cw * ch)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4
    if (rgba[i + 3] > 40 && (rgba[i] + rgba[i + 1] + rgba[i + 2]) / 3 < limiar) cel[Math.floor(y / pxPorMm) * cw + Math.floor(x / pxPorMm)] = 1
  }
  const vis = new Uint8Array(cw * ch), zonas: Zona[] = []
  for (let s = 0; s < cel.length; s++) {
    if (!cel[s] || vis[s]) continue
    let x0 = cw, y0 = ch, x1 = 0, y1 = 0
    const pilha = [s]; vis[s] = 1
    while (pilha.length) {
      const c = pilha.pop()!, cx = c % cw, cy = (c - cx) / cw
      x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy)
      // vizinhança de 2 células: traços finos e o QR viram uma zona só
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = cx + dx, ny = cy + dy
        if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue
        const n = ny * cw + nx
        if (cel[n] && !vis[n]) { vis[n] = 1; pilha.push(n) }
      }
    }
    zonas.push({ x: x0 - folgaMm, y: y0 - folgaMm, w: x1 + 1 - x0 + 2 * folgaMm, h: y1 + 1 - y0 + 2 * folgaMm })
  }
  return zonas
}

/** Zonas da marca em que a arte (regiões de impressão, mm da página) entra. Área mínima: 0,5 mm². */
export function conflitosComMarca(zonas: Zona[], regioes: Pt[][]): Zona[] {
  if (!regioes.length) return []
  const arte = unionD(regioes.map(r => r.map(([x, y]) => ({ x, y }))), FillRule.NonZero) as PathsD
  return zonas.filter(z => {
    const ret = [{ x: z.x, y: z.y }, { x: z.x + z.w, y: z.y }, { x: z.x + z.w, y: z.y + z.h }, { x: z.x, y: z.y + z.h }]
    const i = intersectD([ret], arte, FillRule.NonZero, 3) as PathsD
    return i.reduce((s, p) => s + area(p.map(q => [q.x, q.y] as Pt)), 0) > 0.5
  })
}

export interface Encaixe {
  /** A arte entra girada 90° (prancheta paisagem numa marca retrato, ou vice-versa). */
  girar: boolean
  /** Prancheta de tamanho diferente da folha da marca (alerta). */
  diferente: boolean
  /** Deslocamento (mm) da arte na página para centralizar quando o tamanho difere. */
  dx: number; dy: number
}

export function encaixeNaMarca(artW: number, artH: number, folhaW: number, folhaH: number, tolMm = 0.6): Encaixe {
  const igual = (a: number, b: number) => Math.abs(a - b) <= tolMm
  if (igual(artW, folhaW) && igual(artH, folhaH)) return { girar: false, diferente: false, dx: 0, dy: 0 }
  if (igual(artW, folhaH) && igual(artH, folhaW)) return { girar: true, diferente: false, dx: 0, dy: 0 }
  const girar = (artW > artH) !== (folhaW > folhaH)
  const [w, h] = girar ? [artH, artW] : [artW, artH]
  return { girar, diferente: true, dx: (folhaW - w) / 2, dy: (folhaH - h) / 2 }
}

/**
 * Lote 2 (itens 19/22): a PÁGINA tem sempre o tamanho e a orientação da PRANCHETA. A marca entra por cima:
 * mesma orientação = como está; orientação trocada (ex.: marca retrato numa prancheta paisagem) = a MARCA
 * gira 90° para caber (a arte e o molde nunca giram); tamanho diferente = centralizada, com aviso.
 */
export interface MarcaNaFolha { girar: boolean; diferente: boolean; dx: number; dy: number }
export function marcaNaFolha(folhaW: number, folhaH: number, marcaW: number, marcaH: number, tolMm = 0.6): MarcaNaFolha {
  const igual = (a: number, b: number) => Math.abs(a - b) <= tolMm
  if (igual(folhaW, marcaW) && igual(folhaH, marcaH)) return { girar: false, diferente: false, dx: 0, dy: 0 }
  if (igual(folhaW, marcaH) && igual(folhaH, marcaW)) return { girar: true, diferente: false, dx: 0, dy: 0 }
  const girar = (folhaW > folhaH) !== (marcaW > marcaH)
  const [w, h] = girar ? [marcaH, marcaW] : [marcaW, marcaH]
  return { girar, diferente: true, dx: (folhaW - w) / 2, dy: (folhaH - h) / 2 }
}
/** Zonas com tinta da marca (mm da marca) → mm da folha (prancheta), com o giro/centralização da marca. */
export function zonasNaFolha(zonas: Zona[], e: MarcaNaFolha, marcaH: number): Zona[] {
  return zonas.map(z => (e.girar ? { x: e.dx + marcaH - (z.y + z.h), y: e.dy + z.x, w: z.h, h: z.w } : { x: z.x + e.dx, y: z.y + e.dy, w: z.w, h: z.h }))
}

/** Ponto da prancheta (mm) → ponto da página da marca (mm, y para baixo). */
export function naPagina(e: Encaixe, artH: number, x: number, y: number): Pt {
  return e.girar ? [artH - y + e.dx, x + e.dy] : [x + e.dx, y + e.dy]
}

/**
 * Marca rasterizada (fundo branco) → só a TINTA, com fundo transparente (alfa = quanto escurece), para
 * ir por cima dos PNG transparentes dos apliques. In-place.
 */
export function soTinta(rgba: Uint8ClampedArray): Uint8ClampedArray {
  for (let i = 0; i < rgba.length; i += 4) {
    const l = (rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114) / 255
    const a = Math.round((1 - l) * (rgba[i + 3] / 255) * 255)
    rgba[i] = 0; rgba[i + 1] = 0; rgba[i + 2] = 0; rgba[i + 3] = a
  }
  return rgba
}
