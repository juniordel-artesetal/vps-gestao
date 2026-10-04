// mae-render — AJUSTES NÃO DESTRUTIVOS (Sprint 10), por pixel, determinísticos (sem GPU): brilho/contraste,
// matiz/saturação (com colorizar), níveis, curvas, equilíbrio de cores, vibração, preto e branco e mapa de
// degradê. Trabalham no RGBA (não pré-multiplicado) da camada; o alpha não muda.
import type { Ajuste } from '../schema/edicao'

const cl = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v)
const hexRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

function rgbParaHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2
  if (mx === mn) return [0, 0, l]
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
  const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}
function hslParaRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360 / 360
  if (s <= 0) return [l * 255, l * 255, l * 255]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q
  const f = (t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p }
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]
}

/** Curva monotônica (Fritsch-Carlson) pelos pontos → tabela de 256. */
export function lutDaCurva(pontos: [number, number][]): Uint8ClampedArray {
  const p = [...pontos].sort((a, b) => a[0] - b[0]).filter((v, i, a) => i === 0 || v[0] !== a[i - 1][0])
  const lut = new Uint8ClampedArray(256)
  if (p.length < 2) { for (let i = 0; i < 256; i++) lut[i] = i; return lut }
  const n = p.length, dx: number[] = [], dy: number[] = [], m: number[] = []
  for (let i = 0; i < n - 1; i++) { dx.push(p[i + 1][0] - p[i][0]); dy.push((p[i + 1][1] - p[i][1]) / dx[i]) }
  m.push(dy[0]); for (let i = 1; i < n - 1; i++) m.push(dy[i - 1] * dy[i] <= 0 ? 0 : (dy[i - 1] + dy[i]) / 2); m.push(dy[n - 2])
  for (let i = 0; i < n - 1; i++) if (dy[i] === 0) { m[i] = 0; m[i + 1] = 0 } else {
    const a = m[i] / dy[i], b = m[i + 1] / dy[i], h = a * a + b * b
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * dy[i]; m[i + 1] = t * b * dy[i] }
  }
  for (let x = 0; x < 256; x++) {
    if (x <= p[0][0]) { lut[x] = p[0][1]; continue }
    if (x >= p[n - 1][0]) { lut[x] = p[n - 1][1]; continue }
    let i = 0; while (x > p[i + 1][0]) i++
    const h = dx[i], t = (x - p[i][0]) / h, t2 = t * t, t3 = t2 * t
    lut[x] = (2 * t3 - 3 * t2 + 1) * p[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * p[i + 1][1] + (t3 - t2) * h * m[i + 1]
  }
  return lut
}

export function lutNiveis(a: Extract<Ajuste, { type: 'levels' }>): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256)
  const span = Math.max(1, a.inWhite - a.inBlack)
  for (let x = 0; x < 256; x++) {
    const t = Math.min(1, Math.max(0, (x - a.inBlack) / span)) ** (1 / a.gamma)
    lut[x] = a.outBlack + t * (a.outWhite - a.outBlack)
  }
  return lut
}

/** Aplica UM ajuste no RGBA (in-place), respeitando a opacidade do ajuste. */
export function aplicarAjuste(d: Uint8ClampedArray, a: Ajuste): void {
  if (a.enabled === false || a.opacity <= 0) return
  const op = a.opacity
  const mix = (i: number, r: number, g: number, b: number) => {
    d[i] = cl(d[i] + (r - d[i]) * op); d[i + 1] = cl(d[i + 1] + (g - d[i + 1]) * op); d[i + 2] = cl(d[i + 2] + (b - d[i + 2]) * op)
  }
  const porLut = (lr: Uint8ClampedArray, lg = lr, lb = lr) => { for (let i = 0; i < d.length; i += 4) if (d[i + 3]) mix(i, lr[d[i]], lg[d[i + 1]], lb[d[i + 2]]) }
  switch (a.type) {
    case 'brightnessContrast': {
      const lut = new Uint8ClampedArray(256), c = a.contrast / 100, k = c >= 0 ? 1 / Math.max(0.01, 1 - c) : 1 + c
      for (let x = 0; x < 256; x++) lut[x] = (x + a.brightness - 127.5) * k + 127.5
      return porLut(lut)
    }
    case 'levels': return porLut(lutNiveis(a))
    case 'curves': return porLut(lutDaCurva(a.points))
    case 'hueSaturation': {
      const cor = a.colorize
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue
        let [h, s, l] = rgbParaHsl(d[i], d[i + 1], d[i + 2])
        if (cor) { h = (a.hue + 360) % 360; s = Math.max(0, Math.min(1, 0.25 + a.saturation / 200)) }
        else { h += a.hue; s = Math.max(0, Math.min(1, a.saturation >= 0 ? s + (1 - s) * (a.saturation / 100) * s : s * (1 + a.saturation / 100))) }
        l = a.lightness >= 0 ? l + (1 - l) * a.lightness / 100 : l * (1 + a.lightness / 100)
        const [r, g, b] = hslParaRgb(h, s, l)
        mix(i, r, g, b)
      }
      return
    }
    case 'colorBalance': {
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue
        const L = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255
        const ws = Math.max(0, 1 - L * 2.5), wh = Math.max(0, L * 2.5 - 1.5), wm = Math.max(0, 1 - Math.abs(L - 0.5) * 2.2)
        const off = [0, 1, 2].map(k => (a.shadows[k] * ws + a.midtones[k] * wm + a.highlights[k] * wh) * 0.6)
        mix(i, d[i] + off[0], d[i + 1] + off[1], d[i + 2] + off[2])
      }
      return
    }
    case 'vibrance': {
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue
        const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), med = (r + g + b) / 3
        const sat = (mx - Math.min(r, g, b)) / 255
        const k = 1 + (a.vibrance / 100) * (1 - sat) + a.saturation / 100
        mix(i, med + (r - med) * k, med + (g - med) * k, med + (b - med) * k)
      }
      return
    }
    case 'blackWhite': {
      const tint = a.tint ? hexRgb(a.tint) : null
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue
        const [h] = rgbParaHsl(d[i], d[i + 1], d[i + 2])
        // peso da cor do pixel (6 faixas do Photoshop), interpolado pelo matiz
        const faixas = [a.reds, a.yellows, a.greens, a.cyans, a.blues, a.magentas]
        const pos = h / 60, i0 = Math.floor(pos) % 6, t = pos - Math.floor(pos)
        const w = (faixas[i0] * (1 - t) + faixas[(i0 + 1) % 6] * t) / 100
        const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2])
        const L = cl(mn + (mx - mn) * w)
        if (tint) mix(i, L * tint[0] / 255, L * tint[1] / 255, L * tint[2] / 255)
        else mix(i, L, L, L)
      }
      return
    }
    case 'gradientMap': {
      const st = [...a.stops].sort((x, y) => x.pos - y.pos).map(s => ({ pos: s.pos, c: hexRgb(s.color) }))
      const lut: [number, number, number][] = []
      for (let x = 0; x < 256; x++) {
        const t = x / 255
        let k = 0; while (k < st.length - 2 && t > st[k + 1].pos) k++
        const s0 = st[k], s1 = st[k + 1], u = s1.pos > s0.pos ? Math.max(0, Math.min(1, (t - s0.pos) / (s1.pos - s0.pos))) : 0
        lut.push([0, 1, 2].map(j => s0.c[j] + (s1.c[j] - s0.c[j]) * u) as [number, number, number])
      }
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue
        const L = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])
        mix(i, ...lut[L])
      }
      return
    }
  }
}

/** Aplica a lista de ajustes no RGBA do getImageData (que já vem sem pré-multiplicar). */
export function aplicarAjustes(d: Uint8ClampedArray, ajustes: Ajuste[]): void {
  const ativos = ajustes.filter(a => a.enabled !== false && a.opacity > 0)
  if (!ativos.length) return
  for (const a of ativos) aplicarAjuste(d, a)
}
