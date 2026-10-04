// mae-edição — PINTURA (Sprint 10), em RGBA não pré-multiplicado, no quadrado da camada: pincel e
// borracha (tamanho, dureza, opacidade; respeitam a seleção), lata de tinta (tolerância, contígua),
// degradê (linear, radial, angular, refletido), conta-gotas e paleta do tema. Puro e determinístico.
import type { Selecao } from './selecao'

export type Rgb = [number, number, number]
export interface Pincel { raio: number; dureza: number; opacidade: number; cor: Rgb; apagar?: boolean }

export const hexParaRgb = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
export const rgbParaHex = (c: Rgb) => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')

/** Intensidade do pincel a uma distância d do centro (dureza 0 = macio, 1 = duro). */
export function perfil(d: number, raio: number, dureza: number): number {
  if (d >= raio) return 0
  const h = Math.min(0.999, Math.max(0, dureza)), t = d / raio
  if (t <= h) return 1
  const u = (t - h) / (1 - h)
  return 1 - u * u * (3 - 2 * u)   // smoothstep
}

/** Compõe uma cor com cobertura `k` (0..1) no pixel (src-over); apagar = tira alpha. */
function compor(d: Uint8ClampedArray, i: number, cor: Rgb, k: number, apagar: boolean) {
  if (k <= 0) return
  if (apagar) { d[i + 3] = Math.round(d[i + 3] * (1 - k)); return }
  const a0 = d[i + 3] / 255, a = k + a0 * (1 - k)
  if (a <= 0) return
  for (let c = 0; c < 3; c++) d[i + c] = Math.round((cor[c] * k + d[i + c] * a0 * (1 - k)) / a)
  d[i + 3] = Math.round(a * 255)
}

/**
 * Um "carimbo" do pincel. Para traços, `acumulado` guarda a maior cobertura já aplicada no traço (o
 * traço não escurece onde os carimbos se sobrepõem — opacidade do traço, como no Photoshop).
 */
export function carimbo(d: Uint8ClampedArray, w: number, h: number, x: number, y: number, p: Pincel, sel?: Selecao | null, acumulado?: Float32Array, base?: Uint8ClampedArray) {
  const r = Math.max(0.5, p.raio)
  for (let yy = Math.max(0, Math.floor(y - r)); yy < Math.min(h, Math.ceil(y + r)); yy++)
    for (let xx = Math.max(0, Math.floor(x - r)); xx < Math.min(w, Math.ceil(x + r)); xx++) {
      const pi = yy * w + xx
      let k = perfil(Math.hypot(xx + 0.5 - x, yy + 0.5 - y), r, p.dureza) * p.opacidade
      if (sel) k *= sel.a[pi] / 255
      if (k <= 0) continue
      if (acumulado && base) {
        if (k <= acumulado[pi]) continue
        acumulado[pi] = k
        const i = pi * 4
        d[i] = base[i]; d[i + 1] = base[i + 1]; d[i + 2] = base[i + 2]; d[i + 3] = base[i + 3]
        compor(d, i, p.cor, k, !!p.apagar)
      } else compor(d, pi * 4, p.cor, k, !!p.apagar)
    }
}

/** Traço: carimbos a cada 1/4 do raio ao longo dos pontos. */
export function traco(d: Uint8ClampedArray, w: number, h: number, pts: [number, number][], p: Pincel, sel?: Selecao | null): void {
  if (!pts.length) return
  const acum = new Float32Array(w * h), base = d.slice()
  const passo = Math.max(0.5, p.raio / 4)
  carimbo(d, w, h, pts[0][0], pts[0][1], p, sel, acum, base)
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i]
    const L = Math.hypot(bx - ax, by - ay), n = Math.ceil(L / passo)
    for (let k = 1; k <= n; k++) carimbo(d, w, h, ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n, p, sel, acum, base)
  }
}

/** Lata de tinta: preenche a região parecida (contígua ou não) com a cor; respeita a seleção. */
export function lata(d: Uint8ClampedArray, w: number, h: number, x: number, y: number, cor: Rgb, tolerancia: number, contigua: boolean, opacidade = 1, sel?: Selecao | null): number {
  x = Math.floor(x); y = Math.floor(y)
  if (x < 0 || y < 0 || x >= w || y >= h) return 0
  const i0 = (y * w + x) * 4, ref = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]]
  const casa = (p: number) => {
    const i = p * 4
    if (ref[3] < 8 || d[i + 3] < 8) return Math.abs(d[i + 3] - ref[3]) <= tolerancia
    return Math.max(Math.abs(d[i] - ref[0]), Math.abs(d[i + 1] - ref[1]), Math.abs(d[i + 2] - ref[2])) <= tolerancia
  }
  const marca = new Uint8Array(w * h)
  if (contigua) {
    const pilha = [y * w + x]; marca[y * w + x] = 1
    while (pilha.length) {
      const p = pilha.pop()!, px = p % w, py = (p - px) / w
      for (const n of [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, py > 0 ? p - w : -1, py < h - 1 ? p + w : -1])
        if (n >= 0 && !marca[n] && casa(n)) { marca[n] = 1; pilha.push(n) }
    }
  } else for (let p = 0; p < w * h; p++) if (casa(p)) marca[p] = 1
  let n = 0
  for (let p = 0; p < w * h; p++) if (marca[p]) { compor(d, p * 4, cor, opacidade * (sel ? sel.a[p] / 255 : 1), false); n++ }
  return n
}

export type TipoDegrade = 'linear' | 'radial' | 'angular' | 'reflected'
export interface ParadaCor { pos: number; cor: Rgb; alpha?: number }

/** Posição t (0..1) do pixel no degradê. */
export function tDoDegrade(tipo: TipoDegrade, x: number, y: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1
  if (tipo === 'radial') return Math.min(1, Math.hypot(x - x0, y - y0) / Math.sqrt(L2))
  if (tipo === 'angular') { const a = Math.atan2(y - y0, x - x0) - Math.atan2(dy, dx); return (((a / (2 * Math.PI)) % 1) + 1) % 1 }
  const t = ((x - x0) * dx + (y - y0) * dy) / L2
  return tipo === 'reflected' ? Math.min(1, Math.abs(t)) : Math.min(1, Math.max(0, t))
}

export function corNoDegrade(paradas: ParadaCor[], t: number): [number, number, number, number] {
  const st = [...paradas].sort((a, b) => a.pos - b.pos)
  if (t <= st[0].pos) return [...st[0].cor, st[0].alpha ?? 1]
  for (let k = 0; k + 1 < st.length; k++) {
    const a = st[k], b = st[k + 1]
    if (t <= b.pos) {
      const u = b.pos > a.pos ? (t - a.pos) / (b.pos - a.pos) : 0
      return [a.cor[0] + (b.cor[0] - a.cor[0]) * u, a.cor[1] + (b.cor[1] - a.cor[1]) * u, a.cor[2] + (b.cor[2] - a.cor[2]) * u, (a.alpha ?? 1) + ((b.alpha ?? 1) - (a.alpha ?? 1)) * u]
  }
  }
  const z = st[st.length - 1]
  return [...z.cor, z.alpha ?? 1]
}

/** Pinta um degradê (por cima do que existe, respeitando a seleção). */
export function pintarDegrade(d: Uint8ClampedArray, w: number, h: number, tipo: TipoDegrade, x0: number, y0: number, x1: number, y1: number, paradas: ParadaCor[], opacidade = 1, sel?: Selecao | null): void {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x
    const k0 = sel ? sel.a[p] / 255 : 1
    if (!k0) continue
    const [r, g, b, a] = corNoDegrade(paradas, tDoDegrade(tipo, x + 0.5, y + 0.5, x0, y0, x1, y1))
    compor(d, p * 4, [r, g, b], a * opacidade * k0, false)
  }
}

/** Conta-gotas: média da cor numa janela (raio 0 = o pixel). Ignora transparentes. */
export function contaGotas(d: Uint8ClampedArray | Uint8Array, w: number, h: number, x: number, y: number, raio = 0): Rgb | null {
  let r = 0, g = 0, b = 0, n = 0
  for (let yy = Math.max(0, Math.floor(y) - raio); yy <= Math.min(h - 1, Math.floor(y) + raio); yy++)
    for (let xx = Math.max(0, Math.floor(x) - raio); xx <= Math.min(w - 1, Math.floor(x) + raio); xx++) {
      const i = (yy * w + xx) * 4
      if (d[i + 3] < 8) continue
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++
    }
  return n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : null
}

/**
 * Paleta do tema: as `n` cores principais das imagens (corte pela mediana — determinístico). Amostra
 * no máximo ~40 mil pixels por imagem.
 */
export function paleta(imagens: { d: Uint8ClampedArray | Uint8Array; w: number; h: number }[], n = 8): Rgb[] {
  const px: Rgb[] = []
  for (const im of imagens) {
    const passo = Math.max(1, Math.floor(Math.sqrt((im.w * im.h) / 40000)))
    for (let y = 0; y < im.h; y += passo) for (let x = 0; x < im.w; x += passo) {
      const i = (y * im.w + x) * 4
      if (im.d[i + 3] < 128) continue
      px.push([im.d[i], im.d[i + 1], im.d[i + 2]])
    }
  }
  if (!px.length) return []
  const caixas: Rgb[][] = [px]
  while (caixas.length < n) {
    // corta a caixa de maior faixa no canal de maior faixa
    let melhor = -1, faixa = -1, canal = 0
    caixas.forEach((c, i) => {
      if (c.length < 2) return
      for (let k = 0; k < 3; k++) {
        let mn = 255, mx = 0
        for (const p of c) { if (p[k] < mn) mn = p[k]; if (p[k] > mx) mx = p[k] }
        if (mx - mn > faixa) { faixa = mx - mn; melhor = i; canal = k }
      }
    })
    if (melhor < 0 || faixa <= 4) break
    const c = [...caixas[melhor]].sort((a, b) => a[canal] - b[canal] || a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
    const m = c.length >> 1
    caixas.splice(melhor, 1, c.slice(0, m), c.slice(m))
  }
  return caixas
    .map(c => ({ n: c.length, cor: [0, 1, 2].map(k => Math.round(c.reduce((s, p) => s + p[k], 0) / c.length)) as Rgb }))
    .sort((a, b) => b.n - a.n)
    .map(x => x.cor)
}
