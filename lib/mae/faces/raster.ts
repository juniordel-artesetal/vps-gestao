// mae-faces — ETAPAS RASTER da detecção (puras, Uint8Array/Int32Array; sem DOM):
// binarizar → fechar pontilhado (fechamento morfológico) → rotular regiões → expandir até o centro da
// linha → contorno (pelas bordas dos pixels) com o tipo de cada trecho.
export interface Mascara { w: number; h: number; d: Uint8Array }

/** Luma composta sobre o branco (PNG transparente com linhas pretas também funciona). */
export function binarizar(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, limiar = 200): Mascara {
  const d = new Uint8Array(w * h)
  for (let i = 0, p = 0; i < d.length; i++, p += 4) {
    const a = rgba[p + 3] / 255
    const l = (0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]) * a + 255 * (1 - a)
    d[i] = l < limiar ? 1 : 0
  }
  return { w, h, d }
}

/** Máximo (r = raio) numa direção, por soma acumulada: O(w·h) qualquer que seja o raio. */
function dilatarEixo(m: Mascara, r: number, horizontal: boolean): Mascara {
  const { w, h, d } = m
  const out = new Uint8Array(w * h)
  const [n, linhas] = horizontal ? [w, h] : [h, w]
  const acc = new Int32Array(n + 1)
  for (let l = 0; l < linhas; l++) {
    const idx = (k: number) => (horizontal ? l * w + k : k * w + l)
    for (let k = 0; k < n; k++) acc[k + 1] = acc[k] + d[idx(k)]
    for (let k = 0; k < n; k++) {
      const a = Math.max(0, k - r), b = Math.min(n, k + r + 1)
      out[idx(k)] = acc[b] - acc[a] > 0 ? 1 : 0
    }
  }
  return { w, h, d: out }
}
export function dilatar(m: Mascara, r: number): Mascara {
  if (r <= 0) return m
  return dilatarEixo(dilatarEixo(m, r, true), r, false)
}
export function erodir(m: Mascara, r: number): Mascara {
  if (r <= 0) return m
  const inv = { w: m.w, h: m.h, d: m.d.map(v => 1 - v) }
  const di = dilatar(inv, r)
  return { w: m.w, h: m.h, d: di.d.map(v => 1 - v) }
}
/** "Fechar pontilhado": dilata e erode — liga traços com falhas de até ~2r px sem engordar a linha. */
export function fechar(m: Mascara, r: number): Mascara {
  return r > 0 ? erodir(dilatar(m, r), r) : m
}

/** Caixa (px) dos pixels de linha, ou null se a imagem está vazia. */
export function caixaDaLinha(m: Mascara): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = m.w, y0 = m.h, x1 = -1, y1 = -1
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.d[y * m.w + x]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 }
}

export function recortar(m: Mascara, x: number, y: number, w: number, h: number): Mascara {
  const d = new Uint8Array(w * h)
  for (let yy = 0; yy < h; yy++) {
    const sy = y + yy
    if (sy < 0 || sy >= m.h) continue
    for (let xx = 0; xx < w; xx++) {
      const sx = x + xx
      if (sx >= 0 && sx < m.w) d[yy * w + xx] = m.d[sy * m.w + sx]
    }
  }
  return { w, h, d }
}

/**
 * Rotula as regiões SEM linha (4-vizinhança). 0 = pixel de linha; 1..n = regiões.
 * Devolve também a área (px) e se cada região toca a borda da imagem.
 */
export function rotular(m: Mascara): { rot: Int32Array; n: number; area: number[]; tocaBorda: boolean[] } {
  const { w, h, d } = m
  const rot = new Int32Array(w * h)
  const area = [0], tocaBorda = [false]
  const fila = new Int32Array(w * h)
  let n = 0
  for (let s = 0; s < w * h; s++) {
    if (d[s] || rot[s]) continue
    n++
    let ini = 0, fim = 0, a = 0, borda = false
    fila[fim++] = s; rot[s] = n
    while (ini < fim) {
      const p = fila[ini++]; a++
      const x = p % w, y = (p - x) / w
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) borda = true
      if (x > 0 && !d[p - 1] && !rot[p - 1]) { rot[p - 1] = n; fila[fim++] = p - 1 }
      if (x < w - 1 && !d[p + 1] && !rot[p + 1]) { rot[p + 1] = n; fila[fim++] = p + 1 }
      if (y > 0 && !d[p - w] && !rot[p - w]) { rot[p - w] = n; fila[fim++] = p - w }
      if (y < h - 1 && !d[p + w] && !rot[p + w]) { rot[p + w] = n; fila[fim++] = p + w }
    }
    area.push(a); tocaBorda.push(borda)
  }
  return { rot, n, area, tocaBorda }
}

/**
 * Expande as regiões mantidas sobre os pixels de linha (e sobre as regiões descartadas): cada pixel fica
 * com a região mais PRÓXIMA (distância chanfrada 3-4, quase euclidiana, em 2 passadas). Assim a fronteira
 * entre duas regiões cai no CENTRO da linha, sem fresta e sem "serrilhado" nas diagonais. Determinístico.
 */
export function expandir(rot: Int32Array, w: number, h: number, manter: (r: number) => boolean): Int32Array {
  const out = new Int32Array(w * h)
  const dist = new Int32Array(w * h).fill(0x3fffffff)
  for (let p = 0; p < w * h; p++) if (rot[p] && manter(rot[p])) { out[p] = rot[p]; dist[p] = 0 }
  const relaxa = (p: number, q: number, c: number) => { if (out[q] && dist[q] + c < dist[p]) { dist[p] = dist[q] + c; out[p] = out[q] } }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x
    if (x > 0) relaxa(p, p - 1, 3)
    if (y > 0) {
      relaxa(p, p - w, 3)
      if (x > 0) relaxa(p, p - w - 1, 4)
      if (x < w - 1) relaxa(p, p - w + 1, 4)
    }
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const p = y * w + x
    if (x < w - 1) relaxa(p, p + 1, 3)
    if (y < h - 1) {
      relaxa(p, p + w, 3)
      if (x < w - 1) relaxa(p, p + w + 1, 4)
      if (x > 0) relaxa(p, p + w - 1, 4)
    }
  }
  return out
}

/** Vizinhas de cada região (pares que se tocam por um lado de pixel). */
export function vizinhas(rot: Int32Array, w: number, h: number): Map<number, Set<number>> {
  const v = new Map<number, Set<number>>()
  const liga = (a: number, b: number) => {
    if (a === b) return
    if (!v.has(a)) v.set(a, new Set()); if (!v.has(b)) v.set(b, new Set())
    v.get(a)!.add(b); v.get(b)!.add(a)
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x
    if (x + 1 < w) liga(rot[p], rot[p + 1])
    if (y + 1 < h) liga(rot[p], rot[p + w])
  }
  return v
}

/**
 * Contorno EXTERNO de uma região, pelas bordas dos pixels (cantos com coordenadas inteiras), com a
 * região sempre à direita (sentido horário na tela). Para cada passo, devolve também o rótulo do pixel
 * do OUTRO lado da borda (−1 = fora da imagem) — é ele que diz se o trecho é corte ou dobra.
 */
export function contorno(rot: Int32Array, w: number, h: number, r: number): { pts: [number, number][]; fora: number[] } | null {
  let s = -1
  for (let p = 0; p < w * h; p++) if (rot[p] === r) { s = p; break }
  if (s < 0) return null
  const em = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && rot[y * w + x] === r
  const rotulo = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? rot[y * w + x] : -1)
  const x0 = s % w, y0 = (s - x0) / w
  // começa no canto superior esquerdo do 1º pixel, andando para a direita (borda de cima)
  let cx = x0, cy = y0, d = 0
  const pts: [number, number][] = [], fora: number[] = []
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1]
  const limite = 4 * (w + 1) * (h + 1)
  for (let passo = 0; passo < limite; passo++) {
    // pixel à frente-esquerda (L) e à frente-direita (R) do canto, no sentido d
    let L: [number, number], R: [number, number]
    if (d === 0) { L = [cx, cy - 1]; R = [cx, cy] }
    else if (d === 1) { L = [cx, cy]; R = [cx - 1, cy] }
    else if (d === 2) { L = [cx - 1, cy]; R = [cx - 1, cy - 1] }
    else { L = [cx - 1, cy - 1]; R = [cx, cy - 1] }
    if (em(L[0], L[1])) d = (d + 3) % 4
    else if (!em(R[0], R[1])) d = (d + 1) % 4
    // o lado esquerdo do passo (fora da região) no novo sentido
    let fx: number, fy: number
    if (d === 0) { fx = cx; fy = cy - 1 } else if (d === 1) { fx = cx; fy = cy } else if (d === 2) { fx = cx - 1; fy = cy } else { fx = cx - 1; fy = cy - 1 }
    pts.push([cx, cy]); fora.push(rotulo(fx, fy))
    cx += DX[d]; cy += DY[d]
    if (cx === x0 && cy === y0) break
  }
  return { pts, fora }
}
