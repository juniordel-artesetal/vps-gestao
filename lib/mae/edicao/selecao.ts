// mae-edição — SELEÇÕES (Sprint 10). Uma seleção é um mapa de cobertura 0..255 do tamanho da camada
// (o "quadrado da camada" em pixels). Letreiro (retângulo/elipse), laço e laço poligonal, varinha mágica
// (tolerância, contígua), intervalo de cores, combinar (somar/subtrair/intersectar), expandir/contrair/
// suavizar, inverter — e virar máscara. Puro e determinístico (sem canvas).
export interface Selecao { w: number; h: number; a: Uint8ClampedArray }
export type OpSelecao = 'nova' | 'somar' | 'subtrair' | 'intersectar'

export const vazia = (w: number, h: number): Selecao => ({ w, h, a: new Uint8ClampedArray(w * h) })
export const tudo = (w: number, h: number): Selecao => ({ w, h, a: new Uint8ClampedArray(w * h).fill(255) })
export const temAlgo = (s: Selecao) => s.a.some(v => v > 0)

/** Retângulo (pixels, cantos em qualquer ordem). */
export function selRetangulo(w: number, h: number, x0: number, y0: number, x1: number, y1: number): Selecao {
  const s = vazia(w, h)
  const xa = Math.max(0, Math.round(Math.min(x0, x1))), xb = Math.min(w, Math.round(Math.max(x0, x1)))
  const ya = Math.max(0, Math.round(Math.min(y0, y1))), yb = Math.min(h, Math.round(Math.max(y0, y1)))
  for (let y = ya; y < yb; y++) s.a.fill(255, y * w + xa, y * w + xb)
  return s
}

/** Elipse inscrita no retângulo, com borda suavizada (1 px). */
export function selElipse(w: number, h: number, x0: number, y0: number, x1: number, y1: number): Selecao {
  const s = vazia(w, h)
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2
  if (rx < 0.5 || ry < 0.5) return s
  for (let y = Math.max(0, Math.floor(cy - ry)); y < Math.min(h, Math.ceil(cy + ry)); y++)
    for (let x = Math.max(0, Math.floor(cx - rx)); x < Math.min(w, Math.ceil(cx + rx)); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry
      const d = (Math.sqrt(dx * dx + dy * dy) - 1) * Math.min(rx, ry)   // ~distância em px até a borda
      s.a[y * w + x] = d <= -0.5 ? 255 : d >= 0.5 ? 0 : Math.round((0.5 - d) * 255)
    }
  return s
}

/** Polígono (laço e laço poligonal), regra par-ímpar, com 4×4 amostras por pixel na borda. */
export function selPoligono(w: number, h: number, pts: [number, number][]): Selecao {
  const s = vazia(w, h)
  if (pts.length < 3) return s
  const SS = 4
  const ys = pts.map(p => p[1])
  const yMin = Math.max(0, Math.floor(Math.min(...ys))), yMax = Math.min(h, Math.ceil(Math.max(...ys)))
  const cob = new Float32Array(w)
  for (let y = yMin; y < yMax; y++) {
    cob.fill(0)
    for (let sy = 0; sy < SS; sy++) {
      const yy = y + (sy + 0.5) / SS
      const xs: number[] = []
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j]
        if ((yi > yy) !== (yj > yy)) xs.push(xi + ((yy - yi) / (yj - yi)) * (xj - xi))
      }
      xs.sort((a, b) => a - b)
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const a = Math.max(0, xs[k]), b = Math.min(w, xs[k + 1])
        if (b <= a) continue
        const ia = Math.floor(a), ib = Math.floor(b)
        if (ia === ib) { cob[ia] += (b - a) / SS; continue }
        cob[ia] += (ia + 1 - a) / SS
        for (let x = ia + 1; x < ib; x++) cob[x] += 1 / SS
        if (ib < w) cob[ib] += (b - ib) / SS
      }
    }
    for (let x = 0; x < w; x++) s.a[y * w + x] = Math.round(Math.min(1, cob[x]) * 255)
  }
  return s
}

const dist = (d: Uint8ClampedArray | Uint8Array, i: number, r: number, g: number, b: number) =>
  Math.max(Math.abs(d[i] - r), Math.abs(d[i + 1] - g), Math.abs(d[i + 2] - b))

/**
 * Varinha mágica: pixels com cor parecida à do ponto (tolerância 0–255, como no Photoshop). Contígua =
 * só a região ligada ao ponto (4-vizinhos); senão, todos os pixels parecidos da camada. Pixel
 * transparente só casa com transparente.
 */
export function varinha(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, x: number, y: number, tolerancia: number, contigua = true): Selecao {
  const s = vazia(w, h)
  x = Math.floor(x); y = Math.floor(y)
  if (x < 0 || y < 0 || x >= w || y >= h) return s
  const i0 = (y * w + x) * 4
  const [r, g, b, a0] = [rgba[i0], rgba[i0 + 1], rgba[i0 + 2], rgba[i0 + 3]]
  const casa = (p: number) => {
    const i = p * 4, a = rgba[i + 3]
    if (a0 < 8 || a < 8) return Math.abs(a - a0) <= tolerancia
    return dist(rgba, i, r, g, b) <= tolerancia
  }
  if (!contigua) { for (let p = 0; p < w * h; p++) if (casa(p)) s.a[p] = 255; return s }
  const pilha = [y * w + x]
  s.a[y * w + x] = 255
  while (pilha.length) {
    const p = pilha.pop()!, px = p % w, py = (p - px) / w
    const viz = [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, py > 0 ? p - w : -1, py < h - 1 ? p + w : -1]
    for (const n of viz) if (n >= 0 && !s.a[n] && casa(n)) { s.a[n] = 255; pilha.push(n) }
  }
  return s
}

/** Intervalo de cores: seleção SUAVE (como "Intervalo de cores… / Fuzziness") pela distância à cor. */
export function intervaloDeCores(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, cor: [number, number, number], tolerancia: number): Selecao {
  const s = vazia(w, h)
  const t = Math.max(1, tolerancia)
  for (let p = 0; p < w * h; p++) {
    const i = p * 4
    if (rgba[i + 3] < 8) continue
    const d = dist(rgba, i, cor[0], cor[1], cor[2])
    s.a[p] = d <= t ? Math.round(255 * Math.min(1, (1 - d / t) * 2)) : 0
  }
  return s
}

/** Combina a seleção nova com a atual (nova/somar/subtrair/intersectar). */
export function combinar(atual: Selecao | null, nova: Selecao, op: OpSelecao): Selecao {
  if (!atual || op === 'nova') return nova
  const out = vazia(nova.w, nova.h)
  for (let i = 0; i < out.a.length; i++) {
    const a = atual.a[i], b = nova.a[i]
    out.a[i] = op === 'somar' ? Math.max(a, b) : op === 'subtrair' ? Math.round((a * (255 - b)) / 255) : Math.round((a * b) / 255)
  }
  return out
}

export function inverter(s: Selecao): Selecao {
  const out = vazia(s.w, s.h)
  for (let i = 0; i < out.a.length; i++) out.a[i] = 255 - s.a[i]
  return out
}

/** Distância (px, chanfro 5-7-11 ≈ euclidiana) de cada pixel ao pixel "dentro" (≥ 50%) mais próximo. O(n). */
function distancia(dentro: (p: number) => boolean, w: number, h: number): Float32Array {
  const INF = 1e9, d = new Float32Array(w * h)
  for (let p = 0; p < w * h; p++) d[p] = dentro(p) ? 0 : INF
  const viz = (x: number, y: number, dx: number, dy: number, c: number, v: number) => { const xx = x + dx, yy = y + dy; return xx < 0 || yy < 0 || xx >= w || yy >= h ? v : Math.min(v, d[yy * w + xx] + c) }
  const ida: [number, number, number][] = [[-1, 0, 5], [0, -1, 5], [-1, -1, 7], [1, -1, 7], [-2, -1, 11], [-1, -2, 11], [1, -2, 11], [2, -1, 11]]
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = d[y * w + x]; if (!v) continue; for (const [dx, dy, c] of ida) v = viz(x, y, dx, dy, c, v); d[y * w + x] = v }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { let v = d[y * w + x]; if (!v) continue; for (const [dx, dy, c] of ida) v = viz(x, y, -dx, -dy, c, v); d[y * w + x] = v }
  for (let p = 0; p < w * h; p++) d[p] /= 5
  return d
}

/** Expandir (r > 0) ou contrair (r < 0) a seleção em pixels (borda com 1 px de suavização). */
export function expandir(s: Selecao, r: number): Selecao {
  if (!r) return s
  const { w, h } = s
  const out = vazia(w, h)
  if (r > 0) {
    const d = distancia(p => s.a[p] >= 128, w, h)
    for (let p = 0; p < w * h; p++) out.a[p] = d[p] === 0 ? Math.max(s.a[p], 255) : Math.round(255 * Math.min(1, Math.max(0, r + 1 - d[p])))
  } else {
    const d = distancia(p => s.a[p] < 128, w, h)
    for (let p = 0; p < w * h; p++) out.a[p] = Math.round(255 * Math.min(1, Math.max(0, d[p] + r)))
  }
  return out
}

/** Suavizar a borda (desfoque de caixa 3× ≈ gaussiano), raio em px. */
export function suavizar(s: Selecao, r: number): Selecao {
  const R = Math.round(r)
  if (R < 1) return s
  const { w, h } = s
  const src = Float32Array.from(s.a), tmp = new Float32Array(w * h)
  const caixa = (a: Float32Array, b: Float32Array, horiz: boolean) => {
    const n = horiz ? w : h, m = horiz ? h : w
    for (let j = 0; j < m; j++) {
      let soma = 0
      const idx = (i: number) => (horiz ? j * w + i : i * w + j)
      for (let i = -R; i <= R; i++) soma += a[idx(Math.min(n - 1, Math.max(0, i)))]
      for (let i = 0; i < n; i++) {
        b[idx(i)] = soma / (2 * R + 1)
        soma += a[idx(Math.min(n - 1, i + R + 1))] - a[idx(Math.max(0, i - R))]
      }
    }
  }
  for (let k = 0; k < 3; k++) { caixa(src, tmp, true); caixa(tmp, src, false) }
  void tmp
  return { w, h, a: Uint8ClampedArray.from(src, v => Math.round(v)) }
}

/** Contorno da seleção (para as "formigas"): pixels selecionados (≥ 50%) com vizinho não selecionado. */
export function borda(s: Selecao): Uint8Array {
  const { w, h, a } = s
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x
    if (a[p] < 128) continue
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || a[p - 1] < 128 || a[p + 1] < 128 || a[p - w] < 128 || a[p + w] < 128) out[p] = 1
  }
  return out
}

/** Seleção → máscara (RGBA, alpha = seleção; preto). Com máscara existente: aplica a operação nela. */
export function paraMascaraRgba(s: Selecao, existente?: Uint8ClampedArray | null, op: OpSelecao = 'nova'): Uint8ClampedArray {
  const out = new Uint8ClampedArray(s.w * s.h * 4)
  for (let p = 0; p < s.w * s.h; p++) {
    const atual = existente ? existente[p * 4 + 3] : 0
    const v = !existente || op === 'nova' ? s.a[p] : op === 'somar' ? Math.max(atual, s.a[p]) : op === 'subtrair' ? Math.round((atual * (255 - s.a[p])) / 255) : Math.round((atual * s.a[p]) / 255)
    out[p * 4 + 3] = v
  }
  return out
}
