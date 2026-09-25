// SOA Edition — SELEÇÃO e utilidades de MÁSCARA (só navegador; canvas puro).
// Uma seleção é um canvas de máscara (alfa 255 = selecionado) no espaço NORMALIZADO da imagem
// original da camada — mesmo espaço e resolução da máscara de pintura, então as duas se combinam.
//   • retângulo / laço: polígono preenchido;
//   • varinha mágica: preenchimento por semelhança de cor a partir do ponto clicado;
//   • inverter / suavizar (feather) valem para seleção e para máscara.

export type Pt = { u: number; v: number }

export function novoCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h)
  return c
}

/** Seleção a partir de um polígono (pontos normalizados 0…1). */
export function selecaoPoligono(w: number, h: number, pts: Pt[]): HTMLCanvasElement {
  const c = novoCanvas(w, h)
  if (pts.length < 3) return c
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.beginPath(); g.moveTo(pts[0].u * w, pts[0].v * h)
  for (const p of pts.slice(1)) g.lineTo(p.u * w, p.v * h)
  g.closePath(); g.fill()
  return c
}

/**
 * Varinha mágica: seleciona a região CONTÍGUA com cor parecida à do ponto clicado.
 * `fonte` = conteúdo da camada (qualquer tamanho; é reamostrado para w×h). `tolerancia` 0…100.
 */
export function varinhaMagica(fonte: CanvasImageSource, w: number, h: number, p: Pt, tolerancia: number): HTMLCanvasElement {
  const base = novoCanvas(w, h)
  const bg = base.getContext('2d', { willReadFrequently: true })!
  bg.drawImage(fonte, 0, 0, w, h)
  const d = bg.getImageData(0, 0, w, h).data
  const x0 = Math.max(0, Math.min(w - 1, Math.floor(p.u * w))), y0 = Math.max(0, Math.min(h - 1, Math.floor(p.v * h)))
  const i0 = (y0 * w + x0) * 4
  const r0 = d[i0], g0 = d[i0 + 1], b0 = d[i0 + 2], a0 = d[i0 + 3]
  const lim = (tolerancia / 100) ** 2 * 4 * 255 * 255
  const parecido = (i: number) => {
    const dr = d[i] - r0, dg = d[i + 1] - g0, db = d[i + 2] - b0, da = d[i + 3] - a0
    return dr * dr + dg * dg + db * db + da * da * 1.5 <= lim
  }
  const vis = new Uint8Array(w * h)
  const pilha = [y0 * w + x0]
  vis[y0 * w + x0] = 1
  while (pilha.length) {
    const k = pilha.pop()!
    const x = k % w, y = (k - x) / w
    const viz = [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > 0 ? k - w : -1, y < h - 1 ? k + w : -1]
    for (const n of viz) if (n >= 0 && !vis[n] && parecido(n * 4)) { vis[n] = 1; pilha.push(n) }
  }
  const out = novoCanvas(w, h)
  const og = out.getContext('2d')!
  const img = og.createImageData(w, h)
  for (let k = 0; k < vis.length; k++) if (vis[k]) img.data[k * 4 + 3] = 255
  og.putImageData(img, 0, 0)
  return out
}

/** Combina seleções: nova (substitui), somar, subtrair. */
export function combinarSelecao(atual: HTMLCanvasElement | null, nova: HTMLCanvasElement, modo: 'nova' | 'somar' | 'subtrair'): HTMLCanvasElement {
  if (!atual || modo === 'nova') return nova
  const c = novoCanvas(atual.width, atual.height)
  const g = c.getContext('2d')!
  g.drawImage(atual, 0, 0)
  g.globalCompositeOperation = modo === 'somar' ? 'source-over' : 'destination-out'
  g.drawImage(nova, 0, 0, c.width, c.height)
  return c
}

/** Inverte o alfa (o que era visível some e vice-versa). */
export function inverterAlfa(m: HTMLCanvasElement): HTMLCanvasElement {
  const c = novoCanvas(m.width, m.height)
  const g = c.getContext('2d')!
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height)
  g.globalCompositeOperation = 'destination-out'; g.drawImage(m, 0, 0)
  return c
}

/** Desfoque do alfa (feather): borda suave. Box blur separável em 3 passadas (≈ gaussiano). */
export function suavizarAlfa(m: HTMLCanvasElement, raio: number): HTMLCanvasElement {
  const r = Math.round(raio)
  if (r < 1) return m
  const w = m.width, h = m.height
  const src = m.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h)
  let a = new Float32Array(w * h)
  for (let i = 0; i < a.length; i++) a[i] = src.data[i * 4 + 3]
  let b = new Float32Array(w * h)
  const passo = (ent: Float32Array, sai: Float32Array, horiz: boolean) => {
    const L = horiz ? w : h, N = horiz ? h : w
    for (let n = 0; n < N; n++) {
      let soma = 0
      const idx = (t: number) => (horiz ? n * w + t : t * w + n)
      for (let t = -r; t <= r; t++) soma += ent[idx(Math.max(0, Math.min(L - 1, t)))]
      for (let t = 0; t < L; t++) {
        sai[idx(t)] = soma / (2 * r + 1)
        soma += ent[idx(Math.min(L - 1, t + r + 1))] - ent[idx(Math.max(0, t - r))]
      }
    }
  }
  for (let k = 0; k < 3; k++) { passo(a, b, true); passo(b, a, false) }
  const out = novoCanvas(w, h)
  const og = out.getContext('2d')!
  const img = og.createImageData(w, h)
  for (let i = 0; i < a.length; i++) img.data[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(a[i])))
  og.putImageData(img, 0, 0)
  return out
}

/** Retângulo (normalizado) que contém a seleção — null se vazia. */
export function caixaDaSelecao(m: HTMLCanvasElement): { x: number; y: number; w: number; h: number } | null {
  const w = m.width, h = m.height
  const d = m.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h).data
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  if (x1 < 0) return null
  return { x: x0 / w, y: y0 / h, w: (x1 - x0 + 1) / w, h: (y1 - y0 + 1) / h }
}

/** Sobreposição laranja translúcida para MOSTRAR a seleção na tela. */
export function tingirSelecao(m: HTMLCanvasElement): HTMLCanvasElement {
  const c = novoCanvas(m.width, m.height)
  const g = c.getContext('2d')!
  g.fillStyle = 'rgba(249,115,22,0.38)'; g.fillRect(0, 0, c.width, c.height)
  g.globalCompositeOperation = 'destination-in'; g.drawImage(m, 0, 0)
  return c
}
