// SOA Edition — ACERVO AUTORAL de CENA: fundos prontos (estúdio, festa, mesa), props vetoriais e os
// enfeites da caixa montada (laço de cetim, pedra/strass). 100% GERADO por código (Canvas 2D +
// ruído determinístico) — nenhum arquivo de terceiros. Só navegador.
import { fbm, hash2, ruidoValor, rngSemente } from './produtosAcervo'

type RGB = [number, number, number]
const cl = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v)

/** Qualquer cor CSS → RGB (hex, rgb(), nome). */
let _cc: CanvasRenderingContext2D | null = null
export function rgbDe(cor: string): RGB {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(cor.trim())
  if (m) { const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1]; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] }
  if (!_cc) _cc = document.createElement('canvas').getContext('2d')!
  _cc.fillStyle = '#000'; _cc.fillStyle = cor
  const v = String(_cc.fillStyle)
  if (v.startsWith('#')) return rgbDe(v)
  const n = v.match(/[\d.]+/g) || ['0', '0', '0']
  return [+n[0], +n[1], +n[2]]
}
const css = (c: RGB, a = 1) => `rgba(${Math.round(cl(c[0], 0, 255))},${Math.round(cl(c[1], 0, 255))},${Math.round(cl(c[2], 0, 255))},${a})`
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const clarear = (c: RGB, t: number) => mix(c, [255, 255, 255], t)
const escurecer = (c: RGB, t: number) => mix(c, [20, 16, 24], t)
const lum = (c: RGB) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255

/** Desfoque portátil (sem ctx.filter): desenha fora da tela e deixa só a sombra, na transformação atual. */
function borrado(g: CanvasRenderingContext2D, desenhar: () => void, cor: string, desfoque: number) {
  g.save()
  const m = g.getTransform(), OFF = Math.ceil(g.canvas.width * 2 + desfoque * 3 + Math.abs(m.e))
  g.setTransform(1, 0, 0, 1, -OFF, 0); g.transform(m.a, m.b, m.c, m.d, m.e, m.f)
  g.shadowColor = cor; g.shadowBlur = desfoque; g.shadowOffsetX = OFF
  g.fillStyle = '#000'; g.strokeStyle = '#000'
  desenhar()
  g.restore()
}

/** Granulado de fotografia. */
function grao(g: CanvasRenderingContext2D, w: number, h: number, amp: number, seed: number) {
  const img = g.getImageData(0, 0, w, h), d = img.data
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = (y * w + x) * 4, v = (hash2(x, y, seed) - 0.5) * amp
    d[k] = cl(d[k] + v, 0, 255); d[k + 1] = cl(d[k + 1] + v, 0, 255); d[k + 2] = cl(d[k + 2] + v, 0, 255)
  }
  g.putImageData(img, 0, 0)
}
function vinheta(g: CanvasRenderingContext2D, w: number, h: number, forca: number) {
  const M = Math.max(w, h), gr = g.createRadialGradient(w / 2, h * 0.55, M * 0.35, w / 2, h * 0.55, M * 0.85)
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(20,15,25,${forca})`)
  g.fillStyle = gr; g.fillRect(0, 0, w, h)
}
/** Pinta pixel a pixel numa faixa (rápido o bastante para fundos). */
function porPixel(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, fn: (x: number, y: number, o: number[]) => void) {
  x0 = Math.floor(x0); y0 = Math.floor(y0); w = Math.ceil(w); h = Math.ceil(h)
  if (w <= 0 || h <= 0) return
  const img = g.createImageData(w, h), d = img.data, o = [0, 0, 0]
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    fn(x0 + i, y0 + j, o); const k = (j * w + i) * 4
    d[k] = o[0]; d[k + 1] = o[1]; d[k + 2] = o[2]; d[k + 3] = 255
  }
  g.putImageData(img, x0, y0)
}

// ── estruturas de cena ───────────────────────────────────────────────────────────────────────────
/** Fundo infinito de estúdio (parede curva até o piso), com luz de spot. */
function estudio(g: CanvasRenderingContext2D, w: number, h: number, base: RGB, seed: number) {
  const gr = g.createLinearGradient(0, 0, 0, h)
  gr.addColorStop(0, css(escurecer(base, 0.1))); gr.addColorStop(0.45, css(base)); gr.addColorStop(0.64, css(clarear(base, 0.3)))
  gr.addColorStop(0.8, css(clarear(base, 0.38))); gr.addColorStop(1, css(clarear(base, 0.18)))
  g.fillStyle = gr; g.fillRect(0, 0, w, h)
  const M = Math.max(w, h), sp = g.createRadialGradient(w * 0.5, h * 0.6, 0, w * 0.5, h * 0.6, M * 0.6)
  sp.addColorStop(0, 'rgba(255,255,255,0.4)'); sp.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = sp; g.fillRect(0, 0, w, h)
  vinheta(g, w, h, 0.14)
  grao(g, w, h, 3, seed)
}
/** Parede + piso/mesa com a junção sombreada. */
function ambiente(g: CanvasRenderingContext2D, w: number, h: number, parede: (hz: number) => void, piso: (hz: number) => void, hzN = 0.63, seed = 1) {
  const hz = Math.round(h * hzN)
  g.save(); g.beginPath(); g.rect(0, 0, w, hz); g.clip(); parede(hz)
  const gp = g.createLinearGradient(0, 0, 0, hz)
  gp.addColorStop(0, 'rgba(30,20,30,0.10)'); gp.addColorStop(0.6, 'rgba(0,0,0,0)'); gp.addColorStop(0.96, 'rgba(0,0,0,0)'); gp.addColorStop(1, 'rgba(40,30,40,0.08)')
  g.fillStyle = gp; g.fillRect(0, 0, w, hz)
  g.restore()
  g.save(); g.beginPath(); g.rect(0, hz, w, h - hz); g.clip(); piso(hz)
  const gf = g.createLinearGradient(0, hz, 0, h)
  gf.addColorStop(0, 'rgba(40,30,40,0.07)'); gf.addColorStop(0.04, 'rgba(0,0,0,0)'); gf.addColorStop(1, 'rgba(30,20,30,0.08)')
  g.fillStyle = gf; g.fillRect(0, hz, w, h - hz)
  g.restore()
  const M = Math.max(w, h), sp = g.createRadialGradient(w * 0.5, h * 0.62, 0, w * 0.5, h * 0.62, M * 0.55)
  sp.addColorStop(0, 'rgba(255,255,255,0.22)'); sp.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = sp; g.fillRect(0, 0, w, h)
  vinheta(g, w, h, 0.16)
  grao(g, w, h, 3, seed)
}
const pisoLiso = (g: CanvasRenderingContext2D, w: number, h: number, c: RGB) => (hz: number) => {
  const gr = g.createLinearGradient(0, hz, 0, h); gr.addColorStop(0, css(clarear(c, 0.12))); gr.addColorStop(1, css(escurecer(c, 0.04)))
  g.fillStyle = gr; g.fillRect(0, hz, w, h - hz)
}
const paredeLisa = (g: CanvasRenderingContext2D, w: number, c: RGB) => (hz: number) => {
  const gr = g.createLinearGradient(0, 0, 0, hz); gr.addColorStop(0, css(escurecer(c, 0.05))); gr.addColorStop(1, css(clarear(c, 0.1)))
  g.fillStyle = gr; g.fillRect(0, 0, w, hz)
}

// ── balão (usado no fundo e no prop) ─────────────────────────────────────────────────────────────
function balao(g: CanvasRenderingContext2D, x: number, y: number, r: number, cor: RGB, fio: number) {
  const rx = r, ry = r * 1.18
  const corpo = () => {
    g.beginPath(); g.moveTo(x, y - ry)
    g.bezierCurveTo(x + rx * 1.33, y - ry, x + rx * 1.18, y + ry * 0.72, x + rx * 0.08, y + ry * 0.98)
    g.lineTo(x - rx * 0.08, y + ry * 0.98)
    g.bezierCurveTo(x - rx * 1.18, y + ry * 0.72, x - rx * 1.33, y - ry, x, y - ry); g.closePath()
  }
  if (fio > 0) {
    g.strokeStyle = 'rgba(120,110,120,0.55)'; g.lineWidth = Math.max(1, r * 0.018)
    g.beginPath(); g.moveTo(x, y + ry * 1.05)
    g.bezierCurveTo(x - r * 0.25, y + ry + fio * 0.35, x + r * 0.25, y + ry + fio * 0.65, x - r * 0.05, y + ry + fio); g.stroke()
  }
  // nó
  g.fillStyle = css(escurecer(cor, 0.25)); g.beginPath(); g.moveTo(x - r * 0.1, y + ry * 1.1); g.lineTo(x + r * 0.1, y + ry * 1.1); g.lineTo(x + r * 0.03, y + ry * 0.95); g.lineTo(x - r * 0.03, y + ry * 0.95); g.closePath(); g.fill()
  const gr = g.createRadialGradient(x - rx * 0.35, y - ry * 0.4, r * 0.05, x, y, r * 1.35)
  gr.addColorStop(0, css(clarear(cor, 0.55))); gr.addColorStop(0.45, css(cor)); gr.addColorStop(1, css(escurecer(cor, 0.35)))
  corpo(); g.fillStyle = gr; g.fill()
  g.save(); corpo(); g.clip()
  borrado(g, () => { g.lineWidth = r * 0.12; g.beginPath(); g.arc(x - rx * 0.1, y - ry * 0.05, r * 1.08, 0.1 * Math.PI, 0.55 * Math.PI); g.stroke() }, css(clarear(cor, 0.4), 0.7), r * 0.12)
  const hl = g.createRadialGradient(x - rx * 0.42, y - ry * 0.48, 0, x - rx * 0.42, y - ry * 0.48, r * 0.3)
  hl.addColorStop(0, 'rgba(255,255,255,0.9)'); hl.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = hl; g.beginPath(); g.ellipse(x - rx * 0.42, y - ry * 0.48, r * 0.22, r * 0.32, -0.6, 0, Math.PI * 2); g.fill()
  g.restore()
}

const PASTEIS: RGB[] = [[248, 187, 208], [179, 229, 252], [255, 236, 179], [200, 230, 201], [225, 190, 231], [255, 204, 188]]

function confetes(g: CanvasRenderingContext2D, w: number, h: number, n: number, seed: number, hz: number | null, paleta: RGB[]) {
  const R = rngSemente(seed), m = Math.min(w, h)
  for (let i = 0; i < n; i++) {
    const x = R() * w, y = R() * h, noPiso = hz !== null && y > hz
    const tam = m * (0.008 + R() * 0.012) * (noPiso ? 0.6 + 0.8 * ((y - hz!) / (h - hz!)) : 1)
    const cor = paleta[Math.floor(R() * paleta.length)], tipo = R()
    g.save(); g.translate(x, y); g.rotate(R() * Math.PI * 2); if (noPiso) g.scale(1, 0.55)
    g.fillStyle = css(cor)
    if (noPiso) { g.shadowColor = 'rgba(40,30,40,0.18)'; g.shadowBlur = tam * 0.5; g.shadowOffsetY = tam * 0.2 }
    if (tipo < 0.45) { g.fillRect(-tam, -tam * 0.45, tam * 2, tam * 0.9) }
    else if (tipo < 0.8) { g.beginPath(); g.arc(0, 0, tam * 0.6, 0, Math.PI * 2); g.fill() }
    else { g.strokeStyle = css(cor); g.lineWidth = tam * 0.45; g.lineCap = 'round'; g.beginPath(); g.moveTo(-tam * 1.3, 0); g.bezierCurveTo(-tam * 0.4, -tam, tam * 0.4, tam, tam * 1.3, 0); g.stroke() }
    g.shadowColor = 'transparent'
    g.fillStyle = 'rgba(255,255,255,0.25)'; if (tipo < 0.45) g.fillRect(-tam, -tam * 0.45, tam * 2, tam * 0.25)
    g.restore()
  }
}

function madeira(g: CanvasRenderingContext2D, w: number, h: number, hz: number, seed: number) {
  const tabuas: number[] = [hz]; let a = (h - hz) * 0.07
  while (tabuas[tabuas.length - 1] < h) { tabuas.push(tabuas[tabuas.length - 1] + a); a *= 1.32 }
  const claro: RGB = [226, 196, 156], escuro: RGB = [184, 143, 100]
  porPixel(g, 0, hz, w, h - hz, (x, y, o) => {
    let i = 0; while (tabuas[i + 1] <= y) i++
    const y0 = tabuas[i], y1 = tabuas[i + 1], v = (y - y0) / (y1 - y0), esc = (y1 - y0)
    const tom = hash2(i, 0, seed) * 0.35
    const f = fbm(x / (w * 0.25) + i * 7.3, v * 1.5, seed + i, 3)
    const veio = 0.5 + 0.5 * Math.sin((v * 4 + f * 5 + x / (w * 0.9)) * Math.PI)
    const fino = ruidoValor(x / (esc * 1.5), v * 40, seed + 5)
    const t = 0.25 + 0.4 * veio ** 3 + 0.15 * fino + tom
    const c = mix(claro, escuro, cl(t))
    let k = 1
    if (v < 0.04) k = 0.55 + 0.45 * (v / 0.04)          // fresta
    else if (v < 0.09) k = 1.06                          // quina iluminada
    k *= 0.93 + 0.1 * ((y - hz) / (h - hz))
    o[0] = cl(c[0] * k, 0, 255); o[1] = cl(c[1] * k, 0, 255); o[2] = cl(c[2] * k, 0, 255)
  })
}

function marmore(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, seed: number) {
  const s = 2, pw = Math.ceil(w / s), ph = Math.ceil(h / s)
  const c = document.createElement('canvas'); c.width = pw; c.height = ph
  const cg = c.getContext('2d')!, M = Math.max(w, h) / s
  porPixel(cg, 0, 0, pw, ph, (x, y, o) => {
    const u = x / M, v = (y / M) * 2.6 // piso visto em ângulo: achata na vertical
    const f = fbm(u * 1.6, v * 1.6, seed, 4)
    const tr = (fbm(u * 9, v * 9, seed + 9, 4) - 0.5) * 0.45 // turbulência fina: veio irregular
    const veio = 1 - Math.abs(Math.sin((u * 1.2 + v * 0.5 + f * 2.4 + tr) * Math.PI))
    const nuvem = fbm(u * 4, v * 4, seed + 3, 4)
    const k = 1 - 0.13 * veio ** 18 - 0.07 * veio ** 4 - 0.07 * (nuvem - 0.5)
    o[0] = 246 * k; o[1] = 245 * k; o[2] = 243 * k + 3
  })
  g.drawImage(c, x0, y0, w, h)
}

function nuvem(g: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number, sombra: RGB) {
  const R = rngSemente(seed), bolas: [number, number, number][] = []
  for (let i = 0; i < 9; i++) { const t = i / 8; bolas.push([x + (t - 0.5) * r * 3.2 + (R() - 0.5) * r * 0.3, y - Math.sin(t * Math.PI) * r * 0.55 + (R() - 0.5) * r * 0.2, r * (0.45 + 0.5 * Math.sin(t * Math.PI)) * (0.8 + R() * 0.4)]) }
  const forma = () => { g.beginPath(); for (const [bx, by, br] of bolas) { g.moveTo(bx + br, by); g.arc(bx, by, br, 0, Math.PI * 2) } }
  borrado(g, forma, css(sombra, 0.9), r * 0.18)
  borrado(g, () => { g.save(); g.translate(0, -r * 0.12); forma(); g.fill(); g.restore() }, 'rgba(255,255,255,0.95)', r * 0.14)
}

function bandeirinhas(g: CanvasRenderingContext2D, w: number, x0: number, y0: number, x1: number, y1: number, flecha: number, tam: number, seed: number) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2 + flecha * 2
  const P = (t: number) => ({ x: (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1, y: (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1 })
  const cores: RGB[] = [[244, 143, 177], [255, 213, 79], [129, 212, 250], [165, 214, 167], [206, 147, 216]]
  const n = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / (tam * 1.25)))
  for (let i = 0; i < n; i++) {
    const t0 = (i + 0.12) / n, t1 = (i + 0.88) / n, a = P(t0), b = P(t1), m = P((t0 + t1) / 2)
    const cor = cores[(i + seed) % cores.length], ponta = { x: m.x + (b.y - a.y) * 0.1, y: m.y + tam * 1.15 }
    const tri = () => { g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(ponta.x, ponta.y); g.closePath() }
    g.save(); g.shadowColor = 'rgba(40,30,40,0.18)'; g.shadowBlur = tam * 0.25; g.shadowOffsetY = tam * 0.12; tri(); g.fillStyle = css(cor); g.fill(); g.restore()
    g.save(); tri(); g.clip()
    const gr = g.createLinearGradient(0, m.y, 0, ponta.y); gr.addColorStop(0, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)')
    g.fillStyle = gr; g.fillRect(Math.min(a.x, ponta.x) - tam, m.y - tam, tam * 3, tam * 3)
    if (i % 2 === 0) { g.fillStyle = 'rgba(255,255,255,0.7)'; for (let yy = 0; yy < 4; yy++) for (let xx = -2; xx <= 2; xx++) { g.beginPath(); g.arc(m.x + xx * tam * 0.3 + (yy % 2) * tam * 0.15, m.y + tam * (0.2 + yy * 0.25), tam * 0.055, 0, 7); g.fill() } }
    g.restore()
  }
  g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = Math.max(1.5, tam * 0.03)
  g.beginPath(); for (let i = 0; i <= 60; i++) { const p = P(i / 60); if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y) } g.stroke()
  void w
}

// ── FUNDOS PRONTOS ───────────────────────────────────────────────────────────────────────────────
export const FUNDOS_PRONTOS: { id: string; nome: string; categoria: string; desenhar: (ctx: CanvasRenderingContext2D, w: number, h: number) => void }[] = [
  { id: 'estudio-branco', nome: 'Estúdio branco', categoria: 'Estúdio', desenhar: (g, w, h) => estudio(g, w, h, [236, 236, 238], 1) },
  { id: 'estudio-rosa', nome: 'Estúdio rosa', categoria: 'Estúdio', desenhar: (g, w, h) => estudio(g, w, h, [246, 214, 224], 2) },
  { id: 'estudio-azul', nome: 'Estúdio azul', categoria: 'Estúdio', desenhar: (g, w, h) => estudio(g, w, h, [210, 228, 244], 3) },
  { id: 'estudio-bege', nome: 'Estúdio bege', categoria: 'Estúdio', desenhar: (g, w, h) => estudio(g, w, h, [238, 226, 210], 4) },
  {
    id: 'confete', nome: 'Confete', categoria: 'Festa', desenhar: (g, w, h) => {
      estudio(g, w, h, [250, 238, 236], 5)
      confetes(g, w, h, Math.round((w * h) / 9000), 55, h * 0.63, PASTEIS.concat([[255, 255, 255]]))
    },
  },
  {
    id: 'bolinhas', nome: 'Bolinhas', categoria: 'Festa', desenhar: (g, w, h) => {
      const base: RGB = [252, 228, 236], dot: RGB = [255, 255, 255]
      ambiente(g, w, h, hz => {
        g.fillStyle = css(base); g.fillRect(0, 0, w, hz)
        const e = Math.max(w, h) * 0.075, r = e * 0.22
        g.fillStyle = css(dot)
        for (let j = 0, y = e * 0.4; y < hz + r; j++, y += e * 0.87) for (let x = (j % 2) * e * 0.5; x < w + r; x += e) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill() }
      }, pisoLiso(g, w, h, [248, 246, 244]), 0.63, 6)
    },
  },
  {
    id: 'baloes', nome: 'Balões', categoria: 'Festa', desenhar: (g, w, h) => {
      ambiente(g, w, h, hz => {
        paredeLisa(g, w, [236, 240, 250])(hz)
        const m = Math.min(w, h), cores: RGB[] = [[244, 143, 177], [129, 212, 250], [255, 213, 79], [206, 147, 216], [255, 255, 255]]
        const cachos: [number, number, number][] = [[0.1, 0.16, 1], [0.9, 0.14, 1.05], [0.22, 0.05, 0.8], [0.78, 0.04, 0.8]]
        const R = rngSemente(77); let i = 0
        for (const [cx, cy, s] of cachos) for (let k = 0; k < 5; k++) {
          balao(g, w * cx + (R() - 0.5) * m * 0.2, h * cy + (R() - 0.5) * m * 0.16, m * 0.075 * s * (0.8 + R() * 0.35), cores[i++ % cores.length], m * 0.25)
        }
      }, pisoLiso(g, w, h, [245, 244, 247]), 0.63, 7)
    },
  },
  {
    id: 'mesa-madeira', nome: 'Mesa de madeira', categoria: 'Mesa', desenhar: (g, w, h) => {
      ambiente(g, w, h, hz => {
        paredeLisa(g, w, [240, 234, 226])(hz)
        const l = g.createRadialGradient(w * 0.3, 0, 0, w * 0.3, 0, w * 0.9); l.addColorStop(0, 'rgba(255,250,240,0.5)'); l.addColorStop(1, 'rgba(255,250,240,0)')
        g.fillStyle = l; g.fillRect(0, 0, w, hz)
      }, hz => madeira(g, w, h, hz, 8), 0.6, 8)
    },
  },
  {
    id: 'marmore', nome: 'Mármore', categoria: 'Mesa', desenhar: (g, w, h) => {
      ambiente(g, w, h, paredeLisa(g, w, [232, 233, 236]), hz => marmore(g, 0, hz, w, h - hz, 9), 0.6, 9)
    },
  },
  {
    id: 'bandeirinhas', nome: 'Bandeirinhas', categoria: 'Festa', desenhar: (g, w, h) => {
      ambiente(g, w, h, hz => {
        paredeLisa(g, w, [255, 246, 232])(hz)
        const m = Math.max(w, h)
        bandeirinhas(g, w, -0.05 * w, 0.1 * h, 1.05 * w, 0.06 * h, 0.05 * h, m * 0.045, 1)
        bandeirinhas(g, w, -0.05 * w, 0.02 * h, 0.6 * w, -0.02 * h, 0.07 * h, m * 0.04, 3)
      }, pisoLiso(g, w, h, [250, 247, 242]), 0.63, 10)
    },
  },
  {
    id: 'nuvens', nome: 'Céu com nuvens', categoria: 'Festa', desenhar: (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9fd3f5'); gr.addColorStop(0.7, '#dcefff'); gr.addColorStop(1, '#eef7ff')
      g.fillStyle = gr; g.fillRect(0, 0, w, h)
      const m = Math.max(w, h), sb: RGB = [188, 208, 230]
      nuvem(g, w * 0.18, h * 0.18, m * 0.06, 1, sb); nuvem(g, w * 0.78, h * 0.12, m * 0.075, 2, sb); nuvem(g, w * 0.55, h * 0.32, m * 0.04, 3, sb)
      for (let i = 0; i < 7; i++) nuvem(g, w * (-0.05 + i * 0.18), h * (0.9 + (i % 2) * 0.05), m * 0.09, 10 + i, sb)
      grao(g, w, h, 2.5, 11)
    },
  },
  {
    id: 'listras', nome: 'Listras', categoria: 'Festa', desenhar: (g, w, h) => {
      ambiente(g, w, h, hz => {
        const a: RGB = [253, 239, 243], b: RGB = [246, 205, 218], e = w / 14
        for (let i = 0; i * e < w; i++) { g.fillStyle = css(i % 2 ? b : a); g.fillRect(i * e, 0, e + 1, hz) }
      }, pisoLiso(g, w, h, [250, 246, 245]), 0.63, 12)
    },
  },
]

// ── PROPS (desenhados centrados na origem, cabendo em tamanho×tamanho) ────────────────────────────
function estrela(g: CanvasRenderingContext2D, t: number, c: RGB) {
  const R = t * 0.48, r = t * 0.2, pts: [number, number][] = []
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r : R; pts.push([Math.cos(a) * rr, Math.sin(a) * rr + t * 0.03]) }
  const luz = (-3 * Math.PI) / 4
  for (let i = 0; i < 10; i++) {
    const a = pts[i], b = pts[(i + 1) % 10], ang = Math.atan2((a[1] + b[1]) / 2, (a[0] + b[0]) / 2)
    const k = Math.cos(ang - luz)
    g.fillStyle = css(k > 0 ? clarear(c, k * 0.55) : escurecer(c, -k * 0.35))
    g.beginPath(); g.moveTo(0, t * 0.03); g.lineTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.closePath(); g.fill()
  }
  g.strokeStyle = css(escurecer(c, 0.2), 0.5); g.lineWidth = Math.max(1, t * 0.006)
  g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.stroke()
}

function coracao(g: CanvasRenderingContext2D, t: number, c: RGB) {
  const f = () => { g.beginPath(); g.moveTo(0, t * 0.38); g.bezierCurveTo(-t * 0.62, 0, -t * 0.42, -t * 0.5, 0, -t * 0.24); g.bezierCurveTo(t * 0.42, -t * 0.5, t * 0.62, 0, 0, t * 0.38); g.closePath() }
  const gr = g.createRadialGradient(-t * 0.15, -t * 0.15, t * 0.02, 0, 0, t * 0.55)
  gr.addColorStop(0, css(clarear(c, 0.45))); gr.addColorStop(0.5, css(c)); gr.addColorStop(1, css(escurecer(c, 0.35)))
  f(); g.fillStyle = gr; g.fill()
  g.save(); f(); g.clip()
  borrado(g, () => { g.lineWidth = t * 0.06; g.beginPath(); g.moveTo(t * 0.3, -t * 0.05); g.quadraticCurveTo(t * 0.25, t * 0.15, 0, t * 0.33); g.stroke() }, css(clarear(c, 0.5), 0.6), t * 0.05)
  const hl = g.createRadialGradient(-t * 0.2, -t * 0.22, 0, -t * 0.2, -t * 0.22, t * 0.13)
  hl.addColorStop(0, 'rgba(255,255,255,0.9)'); hl.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = hl; g.beginPath(); g.ellipse(-t * 0.2, -t * 0.22, t * 0.1, t * 0.065, -0.7, 0, Math.PI * 2); g.fill()
  g.restore()
}

function punhadoConfete(g: CanvasRenderingContext2D, t: number, c: RGB) {
  const R = rngSemente(99), pal = [c, clarear(c, 0.5), ...PASTEIS.slice(0, 4), [255, 255, 255] as RGB]
  for (let i = 0; i < 34; i++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * t * 0.42, s = t * (0.035 + R() * 0.03)
    g.save(); g.translate(Math.cos(a) * d, Math.sin(a) * d * 0.7); g.rotate(R() * 6.3)
    g.shadowColor = 'rgba(40,30,40,0.22)'; g.shadowBlur = s * 0.4; g.shadowOffsetY = s * 0.15
    g.fillStyle = css(pal[i % pal.length])
    if (i % 3) g.fillRect(-s, -s * 0.4, s * 2, s * 0.8); else { g.beginPath(); g.arc(0, 0, s * 0.6, 0, 7); g.fill() }
    g.restore()
  }
}

function presente(g: CanvasRenderingContext2D, t: number, c: RGB) {
  const fita: RGB = lum(c) > 0.62 ? escurecer(c, 0.35) : clarear(c, 0.8)
  const d = t * 0.16, e = t * 0.09 // profundidade (dx, dy)
  const x0 = -t * 0.36, x1 = t * 0.2, yT = -t * 0.02, yB = t * 0.44
  const quad = (p: [number, number][], cor: RGB | CanvasGradient) => { g.beginPath(); p.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fillStyle = Array.isArray(cor) ? css(cor) : cor; g.fill() }
  const gf = g.createLinearGradient(x0, 0, x1, 0); gf.addColorStop(0, css(clarear(c, 0.12))); gf.addColorStop(1, css(escurecer(c, 0.05)))
  quad([[x0, yT], [x1, yT], [x1, yB], [x0, yB]], gf)
  quad([[x1, yT], [x1 + d, yT - e], [x1 + d, yB - e], [x1, yB]], escurecer(c, 0.25))
  const fx = (x0 + x1) / 2, fw = t * 0.05
  quad([[fx - fw / 2, yT], [fx + fw / 2, yT], [fx + fw / 2, yB], [fx - fw / 2, yB]], fita)
  quad([[x1 + d * 0.42, yT - e * 0.42], [x1 + d * 0.62, yT - e * 0.62], [x1 + d * 0.62, yB - e * 0.62], [x1 + d * 0.42, yB - e * 0.42]], escurecer(fita, 0.2))
  // tampa
  const lx0 = x0 - t * 0.02, lx1 = x1 + t * 0.02, lT = yT - t * 0.1, lB = yT + t * 0.02
  g.save(); g.shadowColor = 'rgba(0,0,0,0.25)'; g.shadowBlur = t * 0.03; g.shadowOffsetY = t * 0.012
  quad([[lx0, lT], [lx1, lT], [lx1, lB], [lx0, lB]], clarear(c, 0.08)); g.restore()
  quad([[lx1, lT], [lx1 + d, lT - e], [lx1 + d, lB - e], [lx1, lB]], escurecer(c, 0.2))
  quad([[lx0, lT], [lx1, lT], [lx1 + d, lT - e], [lx0 + d, lT - e]], clarear(c, 0.3))
  quad([[fx - fw / 2, lT], [fx + fw / 2, lT], [fx + fw / 2, lB], [fx - fw / 2, lB]], fita)
  quad([[fx - fw / 2, lT], [fx + fw / 2, lT], [fx + fw / 2 + d, lT - e], [fx - fw / 2 + d, lT - e]], clarear(fita, 0.15))
  quad([[lx0 + d * 0.42, lT - e * 0.42], [lx1 + d * 0.42, lT - e * 0.42], [lx1 + d * 0.62, lT - e * 0.62], [lx0 + d * 0.62, lT - e * 0.62]], clarear(fita, 0.15))
  quad([[lx1 + d * 0.42, lT - e * 0.42], [lx1 + d * 0.62, lT - e * 0.62], [lx1 + d * 0.62, lB - e * 0.62], [lx1 + d * 0.42, lB - e * 0.42]], escurecer(fita, 0.2))
  desenharLaco(g, fx + d * 0.52, lT - e * 0.52 - t * 0.06, t * 0.42, css(fita))
}

function vela(g: CanvasRenderingContext2D, t: number, c: RGB) {
  const w = t * 0.12, x0 = -w / 2, yT = -t * 0.12, yB = t * 0.46, e = w * 0.22
  const corpo = () => { g.beginPath(); g.moveTo(x0, yT); g.lineTo(x0, yB); g.ellipse(0, yB, w / 2, e, 0, Math.PI, 0, true); g.lineTo(-x0, yT); g.ellipse(0, yT, w / 2, e, 0, 0, Math.PI, false); g.closePath() }
  corpo(); g.fillStyle = '#fbfaf7'; g.fill()
  g.save(); corpo(); g.clip()
  g.fillStyle = css(c)
  for (let i = -4; i < 14; i++) { const y = yT + i * w * 0.7; g.beginPath(); g.moveTo(x0, y); g.lineTo(-x0, y - w * 0.8); g.lineTo(-x0, y - w * 0.8 + w * 0.32); g.lineTo(x0, y + w * 0.32); g.closePath(); g.fill() }
  const gr = g.createLinearGradient(x0, 0, -x0, 0)
  gr.addColorStop(0, 'rgba(0,0,0,0.18)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(0.45, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)')
  g.fillStyle = gr; g.fillRect(x0, yT - e, w, yB - yT + 2 * e)
  g.restore()
  g.fillStyle = '#f1efe9'; g.beginPath(); g.ellipse(0, yT, w / 2, e, 0, 0, Math.PI * 2); g.fill()
  g.strokeStyle = '#3a3230'; g.lineWidth = Math.max(1, t * 0.008); g.beginPath(); g.moveTo(0, yT); g.quadraticCurveTo(t * 0.005, yT - t * 0.03, -t * 0.003, yT - t * 0.05); g.stroke()
  const fy = yT - t * 0.15
  const brilho = g.createRadialGradient(0, fy, 0, 0, fy, t * 0.2); brilho.addColorStop(0, 'rgba(255,200,90,0.45)'); brilho.addColorStop(1, 'rgba(255,200,90,0)')
  g.fillStyle = brilho; g.beginPath(); g.arc(0, fy, t * 0.2, 0, Math.PI * 2); g.fill()
  const chama = () => { g.beginPath(); g.moveTo(0, fy - t * 0.12); g.bezierCurveTo(t * 0.06, fy - t * 0.02, t * 0.05, fy + t * 0.08, 0, fy + t * 0.09); g.bezierCurveTo(-t * 0.05, fy + t * 0.08, -t * 0.06, fy - t * 0.02, 0, fy - t * 0.12); g.closePath() }
  const gc = g.createRadialGradient(0, fy + t * 0.04, 0, 0, fy + t * 0.02, t * 0.11)
  gc.addColorStop(0, '#ffffff'); gc.addColorStop(0.3, '#fff3b0'); gc.addColorStop(0.7, '#ffb238'); gc.addColorStop(1, 'rgba(255,120,30,0.6)')
  chama(); g.fillStyle = gc; g.fill()
}

function cupcake(g: CanvasRenderingContext2D, t: number, c: RGB) {
  const yT = t * 0.06, yB = t * 0.46, wT = t * 0.33, wB = t * 0.23
  const forma = () => { g.beginPath(); g.moveTo(-wT, yT); g.lineTo(wT, yT); g.lineTo(wB, yB); g.ellipse(0, yB, wB, t * 0.03, 0, 0, Math.PI, false); g.lineTo(-wT, yT); g.closePath() }
  forma(); g.fillStyle = css(c); g.fill()
  g.save(); forma(); g.clip()
  const n = 14
  for (let i = 0; i < n; i++) { // pregas
    const a = i / n, b = (i + 0.5) / n
    g.fillStyle = i % 2 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.18)'
    g.beginPath(); g.moveTo(-wT + 2 * wT * a, yT); g.lineTo(-wT + 2 * wT * b, yT); g.lineTo(-wB + 2 * wB * b, yB + t * 0.03); g.lineTo(-wB + 2 * wB * a, yB + t * 0.03); g.closePath(); g.fill()
  }
  const gr = g.createLinearGradient(-wT, 0, wT, 0); gr.addColorStop(0, 'rgba(255,255,255,0.2)'); gr.addColorStop(0.35, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.28)')
  g.fillStyle = gr; g.fillRect(-wT, yT, 2 * wT, yB - yT + t * 0.04)
  g.restore()
  // cobertura em espiral
  const cob = clarear(c, 0.72)
  const camada = (y: number, w: number, h: number) => {
    const gg = g.createRadialGradient(-w * 0.35, y - h * 0.5, h * 0.1, 0, y, w * 1.1)
    gg.addColorStop(0, '#ffffff'); gg.addColorStop(0.55, css(cob)); gg.addColorStop(1, css(escurecer(cob, 0.22)))
    g.fillStyle = gg; g.beginPath(); g.ellipse(0, y, w, h, 0, 0, Math.PI * 2); g.fill()
  }
  g.save(); g.shadowColor = 'rgba(60,40,50,0.25)'; g.shadowBlur = t * 0.03; g.shadowOffsetY = t * 0.012
  camada(yT - t * 0.005, t * 0.36, t * 0.085); camada(-t * 0.1, t * 0.28, t * 0.08); camada(-t * 0.2, t * 0.19, t * 0.07)
  g.restore()
  g.fillStyle = css(cob); g.beginPath(); g.moveTo(-t * 0.1, -t * 0.24); g.quadraticCurveTo(-t * 0.02, -t * 0.4, t * 0.05, -t * 0.34); g.quadraticCurveTo(t * 0.08, -t * 0.28, t * 0.1, -t * 0.24); g.closePath(); g.fill()
  const R = rngSemente(5), cores = ['#ff6f91', '#ffd166', '#06d6a0', '#4cc9f0', '#ffffff', '#b388eb']
  for (let i = 0; i < 26; i++) {
    const a = R(), y = -t * 0.26 + R() * t * 0.3, lx = (t * 0.33 - (y + t * 0.26) * -0.2) * (y > -t * 0.15 ? 1 : 0.6)
    g.save(); g.translate((a - 0.5) * 2 * lx * 0.85, y); g.rotate(R() * 6.3); g.fillStyle = cores[i % cores.length]
    g.beginPath(); g.ellipse(0, 0, t * 0.016, t * 0.0055, 0, 0, Math.PI * 2); g.fill(); g.restore()
  }
}

export const PROPS: { id: string; nome: string; desenhar: (ctx: CanvasRenderingContext2D, tamanho: number, cor: string) => void }[] = [
  { id: 'balao', nome: 'Balão', desenhar: (g, t, cor) => balao(g, 0, -t * 0.16, t * 0.26, rgbDe(cor), t * 0.3) },
  { id: 'estrela', nome: 'Estrela', desenhar: (g, t, cor) => estrela(g, t, rgbDe(cor)) },
  { id: 'coracao', nome: 'Coração', desenhar: (g, t, cor) => coracao(g, t, rgbDe(cor)) },
  { id: 'confete-punhado', nome: 'Punhado de confete', desenhar: (g, t, cor) => punhadoConfete(g, t, rgbDe(cor)) },
  { id: 'presente', nome: 'Presente', desenhar: (g, t, cor) => presente(g, t, rgbDe(cor)) },
  { id: 'vela', nome: 'Vela', desenhar: (g, t, cor) => vela(g, t, rgbDe(cor)) },
  { id: 'cupcake', nome: 'Cupcake', desenhar: (g, t, cor) => cupcake(g, t, rgbDe(cor)) },
  { id: 'laco', nome: 'Laço', desenhar: (g, t, cor) => desenharLaco(g, 0, 0, t, cor) },
  { id: 'pedra', nome: 'Pedra (strass)', desenhar: (g, t, cor) => desenharPedra(g, 0, 0, t * 0.6, cor) },
]

// ── LAÇO DE CETIM ────────────────────────────────────────────────────────────────────────────────
/** Laço de cetim (duas alças, nó, duas pontas em V) centrado em (cx, cy); `tamanho` = largura total. */
export function desenharLaco(g: CanvasRenderingContext2D, cx: number, cy: number, tamanho: number, cor: string) {
  const c = rgbDe(cor), t = tamanho
  g.save(); g.translate(cx, cy)
  const X = (v: number) => v * t
  const sombra = css(escurecer(c, 0.55), 0.55), luz = css(clarear(c, 0.6), 0.85)

  // pontas (atrás)
  const ponta = (lado: 1 | -1) => {
    g.save(); g.scale(lado, 1)
    const f = () => {
      g.beginPath(); g.moveTo(X(-0.02), X(0.02))
      g.bezierCurveTo(X(0.06), X(0.14), X(0.12), X(0.3), X(0.2), X(0.5))
      g.lineTo(X(0.13), X(0.45)); g.lineTo(X(0.07), X(0.53))
      g.bezierCurveTo(X(0.02), X(0.34), X(-0.02), X(0.18), X(-0.08), X(0.06)); g.closePath()
    }
    const gr = g.createLinearGradient(0, 0, X(0.15), X(0.5))
    gr.addColorStop(0, css(escurecer(c, 0.3))); gr.addColorStop(0.45, css(c)); gr.addColorStop(0.75, css(clarear(c, 0.18))); gr.addColorStop(1, css(escurecer(c, 0.1)))
    f(); g.fillStyle = gr; g.fill()
    g.save(); f(); g.clip()
    borrado(g, () => { g.lineWidth = X(0.018); g.beginPath(); g.moveTo(X(0.0), X(0.1)); g.bezierCurveTo(X(0.05), X(0.22), X(0.08), X(0.34), X(0.13), X(0.47)); g.stroke() }, luz, X(0.015))
    borrado(g, () => { g.lineWidth = X(0.02); g.beginPath(); g.moveTo(X(-0.06), X(0.08)); g.bezierCurveTo(X(-0.01), X(0.2), X(0.03), X(0.36), X(0.07), X(0.52)); g.stroke() }, sombra, X(0.02))
    g.restore(); g.restore()
  }
  ponta(-1); ponta(1)

  // alças
  const alca = (lado: 1 | -1) => {
    g.save(); g.scale(lado, 1)
    const f = () => {
      g.beginPath(); g.moveTo(X(0.03), X(-0.06))
      g.bezierCurveTo(X(0.16), X(-0.3), X(0.48), X(-0.36), X(0.5), X(-0.13))
      g.bezierCurveTo(X(0.52), X(0.06), X(0.24), X(0.15), X(0.03), X(0.06)); g.closePath()
    }
    const gr = g.createRadialGradient(0, 0, X(0.02), X(0.1), X(-0.08), X(0.5))
    gr.addColorStop(0, css(escurecer(c, 0.45))); gr.addColorStop(0.35, css(c)); gr.addColorStop(0.8, css(clarear(c, 0.12))); gr.addColorStop(1, css(escurecer(c, 0.12)))
    f(); g.fillStyle = gr; g.fill()
    g.save(); f(); g.clip()
    // avesso da alça (abertura) na ponta de fora
    borrado(g, () => { g.beginPath(); g.ellipse(X(0.455), X(-0.1), X(0.03), X(0.11), 0.2, 0, Math.PI * 2); g.fill() }, css(escurecer(c, 0.4), 0.75), X(0.03))
    borrado(g, () => { g.lineWidth = X(0.012); g.beginPath(); g.moveTo(X(0.06), X(-0.02)); g.bezierCurveTo(X(0.2), X(-0.12), X(0.34), X(-0.14), X(0.44), X(-0.1)); g.stroke() }, sombra, X(0.02)) // vinco do meio
    // brilho acetinado + vinco
    borrado(g, () => { g.lineWidth = X(0.035); g.beginPath(); g.moveTo(X(0.08), X(-0.1)); g.bezierCurveTo(X(0.18), X(-0.24), X(0.34), X(-0.28), X(0.4), X(-0.22)); g.stroke() }, luz, X(0.03))
    borrado(g, () => { g.lineWidth = X(0.02); g.beginPath(); g.moveTo(X(0.08), X(0.02)); g.bezierCurveTo(X(0.2), X(0.04), X(0.32), X(0.02), X(0.4), X(-0.04)); g.stroke() }, sombra, X(0.025))
    borrado(g, () => { g.lineWidth = X(0.012); g.beginPath(); g.moveTo(X(0.1), X(0.08)); g.bezierCurveTo(X(0.25), X(0.1), X(0.38), X(0.06), X(0.46), X(0.0)); g.stroke() }, luz, X(0.012))
    g.restore()
    g.strokeStyle = css(escurecer(c, 0.4), 0.35); g.lineWidth = Math.max(0.6, X(0.004)); f(); g.stroke()
    g.restore()
  }
  alca(-1); alca(1)

  // nó
  const no = () => { g.beginPath(); g.moveTo(X(-0.07), X(-0.08)); g.quadraticCurveTo(0, X(-0.12), X(0.07), X(-0.08)); g.quadraticCurveTo(X(0.1), 0, X(0.07), X(0.08)); g.quadraticCurveTo(0, X(0.12), X(-0.07), X(0.08)); g.quadraticCurveTo(X(-0.1), 0, X(-0.07), X(-0.08)); g.closePath() }
  g.save(); g.shadowColor = css(escurecer(c, 0.7), 0.45); g.shadowBlur = X(0.03); g.shadowOffsetY = X(0.01)
  const gn = g.createLinearGradient(X(-0.08), X(-0.1), X(0.08), X(0.1))
  gn.addColorStop(0, css(clarear(c, 0.25))); gn.addColorStop(0.5, css(c)); gn.addColorStop(1, css(escurecer(c, 0.3)))
  no(); g.fillStyle = gn; g.fill(); g.restore()
  g.save(); no(); g.clip()
  borrado(g, () => { g.lineWidth = X(0.02); g.beginPath(); g.moveTo(X(-0.03), X(-0.09)); g.quadraticCurveTo(X(-0.05), 0, X(-0.02), X(0.09)); g.stroke() }, luz, X(0.02))
  borrado(g, () => { g.lineWidth = X(0.012); g.beginPath(); g.moveTo(X(0.035), X(-0.09)); g.quadraticCurveTo(X(0.05), 0, X(0.03), X(0.09)); g.stroke() }, sombra, X(0.015))
  g.restore()
  g.restore()
}

// ── PEDRA / STRASS ───────────────────────────────────────────────────────────────────────────────
/** Strass lapidado (mesa octogonal, estrelas, bezéis, cintura) com brilho em cruz; `tamanho` = diâmetro. */
export function desenharPedra(g: CanvasRenderingContext2D, cx: number, cy: number, tamanho: number, cor: string) {
  const c = rgbDe(cor), R = tamanho / 2, luz = (-3 * Math.PI) / 4
  const P = (a: number, r: number): [number, number] => [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
  const face = (pts: [number, number][], inclin: number, idx: number) => {
    let mx = 0, my = 0; for (const p of pts) { mx += p[0]; my += p[1] } mx /= pts.length; my /= pts.length
    const ang = Math.atan2(my - cy, mx - cx)
    const k = 0.5 + 0.42 * Math.cos(ang - luz) * inclin + (hash2(idx, 3, 17) - 0.5) * 0.5
    g.fillStyle = css(k > 0.5 ? clarear(c, (k - 0.5) * 1.5) : escurecer(c, (0.5 - k) * 1.3))
    g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill()
    g.strokeStyle = css(clarear(c, 0.55), 0.45); g.lineWidth = Math.max(0.5, R * 0.012); g.stroke()
  }
  // aro (cintura) escuro + sombra de contato
  g.save(); g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = R * 0.2; g.shadowOffsetY = R * 0.08
  g.fillStyle = css(escurecer(c, 0.5)); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill(); g.restore()
  const rm = R * 0.46, re = R * 0.74, rg = R * 0.95, o = Math.PI / 8
  let idx = 0
  for (let k = 0; k < 8; k++) {
    const a = k * (Math.PI / 4)                    // ângulo da estrela
    face([P(a, re), P(a - o, rg), P(a, rg)], 1, idx++)  // meia-cintura
    face([P(a, re), P(a, rg), P(a + o, rg)], 1, idx++)
    const b = a + o                                 // vértice da mesa
    face([P(b, rm), P(a, re), P(b, rg), P(b + 2 * o, re)], 0.8, idx++) // bezel (pipa)
    face([P(b - 2 * o, rm), P(b, rm), P(a, re)], 0.5, idx++)             // estrela
  }
  const mesa: [number, number][] = []; for (let k = 0; k < 8; k++) mesa.push(P(k * (Math.PI / 4) + o, rm))
  const gm = g.createLinearGradient(cx - rm, cy - rm, cx + rm, cy + rm)
  gm.addColorStop(0, css(clarear(c, 0.55))); gm.addColorStop(0.5, css(clarear(c, 0.15))); gm.addColorStop(1, css(escurecer(c, 0.15)))
  g.beginPath(); mesa.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fillStyle = gm; g.fill()
  g.strokeStyle = css(clarear(c, 0.7), 0.6); g.lineWidth = Math.max(0.5, R * 0.015); g.stroke()
  // reflexo interno + brilho em cruz
  const ri = g.createRadialGradient(cx - R * 0.1, cy - R * 0.1, 0, cx, cy, R)
  ri.addColorStop(0, 'rgba(255,255,255,0.18)'); ri.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = ri; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill()
  const brilho = (x: number, y: number, L: number) => {
    const gl = g.createRadialGradient(x, y, 0, x, y, L * 0.5); gl.addColorStop(0, 'rgba(255,255,255,0.95)'); gl.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gl; g.beginPath(); g.arc(x, y, L * 0.5, 0, Math.PI * 2); g.fill()
    g.fillStyle = 'rgba(255,255,255,0.95)'
    for (const [dx, dy, l] of [[1, 0, L], [0, 1, L], [0.7, 0.7, L * 0.45], [0.7, -0.7, L * 0.45]] as const) {
      const w = L * 0.045
      g.beginPath(); g.moveTo(x - dx * l, y - dy * l); g.lineTo(x - dy * w, y + dx * w); g.lineTo(x + dx * l, y + dy * l); g.lineTo(x + dy * w, y - dx * w); g.closePath(); g.fill()
    }
  }
  brilho(cx - R * 0.32, cy - R * 0.36, R * 0.62)
  brilho(cx + R * 0.38, cy + R * 0.3, R * 0.26)
}
