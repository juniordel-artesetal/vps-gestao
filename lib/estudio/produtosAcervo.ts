// SOA Edition — ACERVO AUTORAL de produtos lisos (Fluxo B do Mockup). 100% GERADO por código:
// Canvas 2D + sombreamento por pixel (normais de cilindro/tubo, luz de softbox) + ruído determinístico.
// Nenhuma foto de terceiros. Cada produto sai BRANCO/CLARO sobre fundo TRANSPARENTE, sem sombra
// projetada (a cena põe depois), e com a área de aplicação acompanhando a superfície (caneca curva).
// Só navegador (document.createElement('canvas')).
import type { ProdutoAcervo, ProdutoGerado } from './mockupTipos'
import type { AreaAplicacao } from './areaMolde'
import { distorcer, type Ponto } from './transform'

// ── utilitários ──────────────────────────────────────────────────────────────────────────────────
const tela = (w: number, h: number) => {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h))
  return c
}
const ctx2d = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!
const cl = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v)
const suave = (a: number, b: number, x: number) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t) }
const gauss = (x: number, c: number, w: number) => Math.exp(-((x - c) / w) * ((x - c) / w))

/** Hash inteiro → [0,1) (determinístico). */
export function hash2(ix: number, iy: number, seed: number) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(seed | 0, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
/** Ruído de valor suave (0…1). */
export function ruidoValor(x: number, y: number, seed: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed)
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy
}
/** Ruído fractal (0…1). */
export function fbm(x: number, y: number, seed: number, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0
  for (let i = 0; i < oct; i++) { s += a * ruidoValor(x * f, y * f, seed + i * 31); n += a; a *= 0.5; f *= 2 }
  return s / n
}
/** Gerador pseudoaleatório com semente (mulberry32). */
export function rngSemente(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Pinta pixel a pixel no retângulo; `fn` escreve a cor em `o` (0…255) e devolve a cobertura (0…1). */
function pintar(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number, o: number[]) => number) {
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0))
  x1 = Math.min(g.canvas.width, Math.ceil(x1)); y1 = Math.min(g.canvas.height, Math.ceil(y1))
  const w = x1 - x0, h = y1 - y0
  if (w <= 0 || h <= 0) return
  const img = new ImageData(w, h), d = img.data, o = [0, 0, 0]
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const a = fn(x0 + i + 0.5, y0 + j + 0.5, o)
    if (a <= 0) continue
    const k = (j * w + i) * 4
    d[k] = o[0]; d[k + 1] = o[1]; d[k + 2] = o[2]; d[k + 3] = a >= 1 ? 255 : a * 255
  }
  const t = tela(w, h); ctx2d(t).putImageData(img, 0, 0)
  g.drawImage(t, x0, y0) // respeita o clip ativo (borda suavizada pelo próprio canvas)
}

/** Granulado/manchas/fibras só onde já há produto (alfa > 0). */
function granular(g: CanvasRenderingContext2D, seed: number, op: { grao: number; mancha?: number; escala?: number; fibra?: number; fibraV?: boolean }) {
  const { width: W, height: H } = g.canvas
  const img = g.getImageData(0, 0, W, H), d = img.data
  const esc = op.escala || 40, m = op.mancha || 0, f = op.fibra || 0
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = (y * W + x) * 4
    if (d[k + 3] === 0) continue
    let dv = (hash2(x, y, seed) - 0.5) * op.grao
    if (m) dv += (fbm(x / esc, y / esc, seed + 7, 3) - 0.5) * m
    if (f) dv += (op.fibraV ? ruidoValor(x / 1.3, y / 26, seed + 9) : ruidoValor(x / 26, y / 1.3, seed + 9)) * f - f / 2
    d[k] = cl(d[k] + dv, 0, 255); d[k + 1] = cl(d[k + 1] + dv, 0, 255); d[k + 2] = cl(d[k + 2] + dv * 0.9, 0, 255)
  }
  g.putImageData(img, 0, 0)
}

// ── luz de estúdio (softbox alto à esquerda + rebatedor à direita) ────────────────────────────────
const LX = -0.5, LY = -0.5, LZ = Math.SQRT1_2
let _k = 1, _s = 0
/** Material brilhante (cerâmica, tinta): difusa + reflexo das softboxes (faixa vertical). */
function luzBrilho(nx: number, ny: number, nz: number, brilho = 1) {
  const dif = Math.max(0, nx * LX + ny * LY + nz * LZ)
  _k = (0.64 + 0.34 * dif) * (0.9 + 0.1 * nz)
  const rx = 2 * nz * nx, ry = 2 * nz * ny
  const faixaY = suave(-0.95, -0.55, ry) * (1 - suave(0.35, 0.8, ry))
  _s = brilho * faixaY * (0.7 * gauss(rx, -0.86, 0.055) + 0.08 * gauss(rx, -0.6, 0.35) + 0.14 * gauss(rx, 0.88, 0.05))
  _k += 0.1 * Math.pow(1 - nz, 3) // borda reflete o ambiente (vidrado)
}
/** Material fosco (papel, glacê, tecido). */
function luzFosca(nx: number, ny: number, nz: number) {
  const dif = Math.max(0, nx * LX + ny * LY + nz * LZ)
  _k = (0.66 + 0.42 * dif) * (0.9 + 0.1 * nz); _s = 0
}
/** Metal (lata): reflete um "estúdio" em faixas. */
function luzMetal(nx: number, ny: number, nz: number) {
  const rx = 2 * nz * nx, ry = 2 * nz * ny
  _k = 0.62 + 0.4 * gauss(rx, -0.8, 0.16) + 0.28 * gauss(rx, 0.85, 0.09) + 0.14 * gauss(rx, 0.05, 0.4) - 0.1 * gauss(rx, 0.45, 0.12)
  _k *= 1 - 0.18 * suave(0.2, 0.9, ry) + 0.1 * (1 - suave(-0.9, -0.3, ry))
  _s = 0.6 * gauss(rx, -0.8, 0.05)
}

// ── geometria ──────────────────────────────────────────────────────────────────────────────────
function bezier(p0: Ponto, p1: Ponto, p2: Ponto, p3: Ponto, n = 80): Ponto[] {
  const out: Ponto[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3
    out.push({ x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y })
  }
  return out
}

/**
 * Tubo 3D ao longo de uma linha (alça, palito, barbante, corda torcida). Por pixel: distância à
 * linha → normal do tubo. `fn(nx,ny,nz, t, arco, lado, x, y, o)` pinta; lado ∈ [-1,1] através do tubo.
 */
function tubo(g: CanvasRenderingContext2D, pts: Ponto[], raio: (t: number) => number,
  fn: (nx: number, ny: number, nz: number, t: number, arco: number, lado: number, x: number, y: number, o: number[]) => void) {
  const n = pts.length, cum = [0]
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  const total = cum[n - 1] || 1
  let rmax = 0; for (let i = 0; i <= 20; i++) rmax = Math.max(rmax, raio(i / 20))
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y) }
  pintar(g, x0 - rmax - 2, y0 - rmax - 2, x1 + rmax + 2, y1 + rmax + 2, (x, y, o) => {
    let best = Infinity, bi = 0, bt = 0, qx = 0, qy = 0, sg = 1
    for (let i = 0; i < n - 1; i++) {
      const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1e-9
      const tt = cl(((x - a.x) * dx + (y - a.y) * dy) / l2)
      const px = a.x + dx * tt, py = a.y + dy * tt, d2 = (x - px) ** 2 + (y - py) ** 2
      if (d2 < best) { best = d2; bi = i; bt = tt; qx = px; qy = py; sg = dx * (y - a.y) - dy * (x - a.x) >= 0 ? 1 : -1 }
    }
    const d = Math.sqrt(best), arco = cum[bi] + bt * (cum[bi + 1] - cum[bi]), t = arco / total, r = raio(t)
    if (d > r + 0.5) return 0
    const s = Math.min(1, d / r), ux = d > 1e-6 ? (x - qx) / d : 0, uy = d > 1e-6 ? (y - qy) / d : 0
    fn(ux * s, uy * s, Math.sqrt(1 - s * s), t, arco, sg * s, x, y, o)
    return cl(r - d + 0.5)
  })
}

/** Homografia do quadrado unitário → quadrilátero (TL, TR, BR, BL) — a mesma do transform. */
function homografia(p0: Ponto, p1: Ponto, p2: Ponto, p3: Ponto) {
  const sx = p0.x - p1.x + p2.x - p3.x, sy = p0.y - p1.y + p2.y - p3.y
  let H: number[]
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) H = [p1.x - p0.x, p2.x - p1.x, p0.x, p1.y - p0.y, p2.y - p1.y, p0.y, 0, 0, 1]
  else {
    const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, den = dx1 * dy2 - dx2 * dy1
    const gg = (sx * dy2 - dx2 * sy) / den, hh = (dx1 * sy - sx * dy1) / den
    H = [p1.x - p0.x + gg * p1.x, p3.x - p0.x + hh * p3.x, p0.x, p1.y - p0.y + gg * p1.y, p3.y - p0.y + hh * p3.y, p0.y, gg, hh, 1]
  }
  return (u: number, v: number): Ponto => { const w = H[6] * u + H[7] * v + H[8]; return { x: (H[0] * u + H[1] * v + H[2]) / w, y: (H[3] * u + H[4] * v + H[5]) / w } }
}
/** Ponto bilinear num quadrilátero (TL, TR, BR, BL). */
const bilinear = (q: Ponto[], u: number, v: number): Ponto => {
  const t = { x: q[0].x + (q[1].x - q[0].x) * u, y: q[0].y + (q[1].y - q[0].y) * u }
  const b = { x: q[3].x + (q[2].x - q[3].x) * u, y: q[3].y + (q[2].y - q[3].y) * u }
  return { x: t.x + (b.x - t.x) * v, y: t.y + (b.y - t.y) * v }
}
const norm = (pts: Ponto[], W: number, H: number) => pts.map(p => ({ x: +(p.x / W).toFixed(5), y: +(p.y / H).toFixed(5) }))
const poligono = (g: CanvasRenderingContext2D, pts: Ponto[]) => { g.beginPath(); g.moveTo(pts[0].x, pts[0].y); for (const p of pts.slice(1)) g.lineTo(p.x, p.y); g.closePath() }

/** Traço suave (desfocado) portátil: usa a sombra do canvas, desenhando o traço fora da tela. */
function tracoSuave(g: CanvasRenderingContext2D, desenhar: () => void, cor: string, largura: number, desfoque: number) {
  const OFF = Math.ceil(g.canvas.width + largura + desfoque * 3) // fora da tela, mas perto (o Chrome recorta sombras muito longe)
  g.save()
  g.shadowColor = cor; g.shadowBlur = desfoque; g.shadowOffsetX = OFF
  g.translate(-OFF, 0); g.lineWidth = largura; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#000'; g.fillStyle = '#000'
  desenhar()
  g.restore()
}

/**
 * Cilindro de pé visto um pouco de cima (caneca, lata, bolo). Pinta a FACE FRONTAL com `mat`
 * (recebe a normal e u∈[-1,1], v∈[0,1] na altura). Recorta pelo contorno (borda suavizada).
 */
function cilindro(g: CanvasRenderingContext2D, cx: number, rx: number, yT: number, yB: number, eT: number, eB: number,
  mat: (u: number, v: number, x: number, y: number, o: number[]) => void) {
  g.save(); g.beginPath()
  g.moveTo(cx - rx, yT); g.lineTo(cx - rx, yB)
  g.ellipse(cx, yB, rx, eB, 0, Math.PI, 0, true)
  g.lineTo(cx + rx, yT)
  g.ellipse(cx, yT, rx, eT, 0, 0, Math.PI, false)
  g.closePath(); g.clip()
  pintar(g, cx - rx - 1, yT - 1, cx + rx + 1, yB + eB + 1, (x, y, o) => {
    const u = cl((x - cx) / rx, -1, 1), nz = Math.sqrt(1 - u * u)
    const yt = yT + eT * nz, yb = yB + eB * nz
    mat(u, cl((y - yt) / (yb - yt)), x, y, o)
    return 1
  })
  g.restore()
}
/** Pinta a cor base × k + brilho. */
const tom = (o: number[], r: number, gg: number, b: number, k: number, s: number) => {
  o[0] = cl(r * k + 255 * s, 0, 255); o[1] = cl(gg * k + 255 * s, 0, 255); o[2] = cl(b * k + 255 * s + (1 - k) * 8, 0, 255)
}

/** Faixa curva (malha) sobre um cilindro: colunas em ângulo igual, linhas seguindo as elipses. */
function faixaCilindro(cx: number, rx: number, yT: number, yB: number, eT: number, eB: number, yA: number, yZ: number, grausMax: number, cols: number, rows: number, W: number, H: number): AreaAplicacao {
  const pts: Ponto[] = [], tm = (grausMax * Math.PI) / 180
  for (let r = 0; r < rows; r++) {
    const yl = yA + ((yZ - yA) * r) / (rows - 1), e = eT + ((eB - eT) * (yl - yT)) / (yB - yT)
    for (let c = 0; c < cols; c++) {
      const th = -tm + (2 * tm * c) / (cols - 1)
      pts.push({ x: cx + rx * Math.sin(th), y: yl + e * Math.cos(th) })
    }
  }
  return { tipo: 'malha', cols, rows, pontos: norm(pts, W, H) }
}

// ── CANECA ─────────────────────────────────────────────────────────────────────────────────────
function gerarCaneca(lado: number): ProdutoGerado {
  const s = lado, W = lado, H = Math.round(lado * 0.88)
  const cv = tela(W, H), g = ctx2d(cv)
  const cx = 0.385 * s, rx = 0.31 * s, eT = 0.16 * rx, eB = 0.2 * rx, yT = 0.075 * s, yB = yT + 0.72 * s, Hb = yB - yT
  const BR = 248, BG = 248, BB = 246

  // alça (atrás do corpo — as pontas somem dentro dele)
  const alca = bezier({ x: cx + 0.78 * rx, y: yT + 0.16 * Hb }, { x: cx + rx + 0.68 * rx, y: yT + 0.02 * Hb },
    { x: cx + rx + 0.66 * rx, y: yT + 0.84 * Hb }, { x: cx + 0.78 * rx, y: yT + 0.74 * Hb }, 90)
  tubo(g, alca, t => rx * (0.1 - 0.025 * Math.sin(t * Math.PI)), (nx, ny, nz, _t, _a, _l, x, _y, o) => {
    luzBrilho(nx, ny * 0.9, nz)
    const perto = 1 - suave(0, 0.18 * rx, x - (cx + rx)) // oclusão junto ao corpo
    tom(o, BR, BG, BB, _k * (1 - 0.28 * perto), _s * (1 - perto))
  })

  // corpo
  cilindro(g, cx, rx, yT, yB, eT, eB, (u, v, _x, _y, o) => {
    let ny = 0
    const dt = (v * Hb) / (0.016 * s), db = ((1 - v) * Hb) / (0.03 * s)
    if (dt < 1) ny -= 0.6 * (1 - dt) ** 2 // lábio arredondado pega luz
    if (db < 1) ny += 0.9 * (1 - db) ** 2 // pé curva para baixo
    let nx = u, nz = Math.sqrt(1 - u * u)
    const L = Math.hypot(nx, ny, nz); nx /= L; ny /= L; nz /= L
    luzBrilho(nx, ny, nz)
    tom(o, BR, BG, BB, _k, _s)
  })

  // borda (espessura da parede) + interior
  const rxi = rx * 0.935, ei = eT * 0.935
  g.save(); g.beginPath(); g.ellipse(cx, yT, rx, eT, 0, 0, Math.PI * 2)
  const gr = g.createLinearGradient(cx - rx, 0, cx + rx, 0)
  gr.addColorStop(0, '#f3f3f1'); gr.addColorStop(0.35, '#fdfdfc'); gr.addColorStop(1, '#cfd0d0')
  g.fillStyle = gr; g.fill(); g.restore()
  g.save(); g.beginPath(); g.ellipse(cx, yT + eT * 0.03, rxi, ei, 0, 0, Math.PI * 2); g.clip()
  pintar(g, cx - rxi - 1, yT - ei - 1, cx + rxi + 1, yT + ei + 2, (x, y, o) => {
    const u = cl((x - cx) / rxi, -1, 1), nz = Math.sqrt(1 - u * u)
    const t = cl((y - (yT - ei)) / (2 * ei))
    const dif = Math.max(0, -u * LX + nz * LZ * 0.6 + 0.25)
    const k = (0.5 + 0.42 * dif) * (1 - 0.5 * t ** 1.4) * (0.85 + 0.15 * nz)
    const sp = 0.3 * gauss(u, 0.5, 0.06) * (1 - t)
    tom(o, BR, BG, BB, k, sp)
    return 1
  })
  g.restore()
  // brilho no lábio da frente
  g.save(); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 0.004 * s; g.lineCap = 'round'
  g.beginPath(); g.ellipse(cx, yT, rx * 0.985, eT * 0.97, 0, Math.PI * 0.58, Math.PI * 0.86); g.stroke()
  g.strokeStyle = 'rgba(120,122,128,0.25)'; g.lineWidth = 0.0025 * s
  g.beginPath(); g.ellipse(cx, yT + eT * 0.03, rxi, ei, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke()
  g.restore()

  granular(g, 11, { grao: 2.2 })
  return {
    foto: cv,
    area: faixaCilindro(cx, rx, yT, yB, eT, eB, yT + 0.09 * Hb, yB - 0.08 * Hb, 66, 7, 3, W, H),
    recorte: null,
    ls: { sombra: 75, luz: 80, direcao: 135 },
    medidas: { largura: 8.2, altura: 9.5, profundidade: 8.2 },
  }
}

// ── LATA (lembrancinha de festa) ─────────────────────────────────────────────────────────────────
function gerarLata(lado: number, prata: boolean): ProdutoGerado {
  const s = lado, W = Math.round(lado * 0.8), H = lado
  const cv = tela(W, H), g = ctx2d(cv)
  const cx = W / 2, rx = 0.37 * W, eT = 0.17 * rx, eB = 0.2 * rx
  const yT = 0.07 * s, hl = 0.085 * s, yB = 0.9 * s
  const rl = rx * 1.035, eTl = eT * 1.035
  const yCorpo = yT + hl - 0.01 * s, Hb = yB - yCorpo
  const M = [226, 229, 233]

  // corpo (tinta branca brilhante, ou folha de flandres)
  cilindro(g, cx, rx, yCorpo, yB, eT, eB, (u, v, x, y, o) => {
    const nz = Math.sqrt(1 - u * u)
    const bb = ((1 - v) * Hb) / (0.034 * s) // frisos do fundo
    if (bb < 1) {
      const ny = 0.8 * Math.cos(Math.PI * bb)
      luzMetal(u, ny, nz); const r = ruidoValor(x / 1.2, y / 30, 5) * 0.06
      tom(o, M[0], M[1], M[2], _k + r, _s)
      return
    }
    if (prata) {
      luzMetal(u, 0, nz); const r = (ruidoValor(x / 60, y / 1.1, 3) - 0.5) * 0.05
      tom(o, M[0], M[1], M[2], _k + r, _s)
    } else {
      luzBrilho(u, 0, nz, 0.75)
      const sob = 1 - suave(0, 0.03 * s, v * Hb) // sombra da aba da tampa
      tom(o, 247, 247, 245, _k * (1 - 0.3 * sob), _s * (1 - sob))
    }
  })
  // tampa: saia + face de cima
  cilindro(g, cx, rl, yT, yT + hl, eTl, eTl * 1.02, (u, v, x, y, o) => {
    const nz = Math.sqrt(1 - u * u)
    let ny = 0
    if (v < 0.22) ny = -0.8 * (1 - v / 0.22) ** 1.5         // enrolado de cima
    else if (v > 0.8) ny = 0.7 * ((v - 0.8) / 0.2) ** 1.2   // aba de baixo
    else ny = 0.08 * Math.sin((v - 0.22) * 40)             // frisos da saia
    const L = Math.hypot(u, ny, nz)
    luzMetal(u / L, ny / L, nz / L)
    tom(o, M[0], M[1], M[2], _k + (ruidoValor(x / 1.2, y / 25, 8) - 0.5) * 0.04, _s)
  })
  g.save(); g.beginPath(); g.ellipse(cx, yT, rl, eTl, 0, 0, Math.PI * 2); g.clip()
  pintar(g, cx - rl - 1, yT - eTl - 1, cx + rl + 1, yT + eTl + 1, (x, y, o) => {
    const dx = (x - cx) / rl, dy = (y - yT) / eTl, rho = Math.sqrt(dx * dx + dy * dy)
    // anéis concêntricos: borda enrolada, rebaixo, painel com frisos
    let k = 0.8 - 0.14 * dx - 0.06 * dy
    k += 0.22 * gauss(rho, 0.97, 0.025) * (dy < 0 ? 1 : 0.6) - 0.25 * gauss(rho, 0.915, 0.02)
    k += 0.07 * Math.sin(rho * 60) * suave(0.3, 0.85, rho) * (1 - suave(0.85, 0.88, rho))
    k += 0.08 * gauss(rho, 0.55, 0.05) - 0.05 * gauss(rho, 0.6, 0.03)
    k += (ruidoValor(Math.atan2(dy, dx) * 400, rho * 6, 4) - 0.5) * 0.05 // escovado circular
    const sp = 0.35 * gauss(dx + dy * 0.4, -0.35, 0.12) * suave(0.2, 0.9, rho)
    tom(o, M[0], M[1], M[2], k, sp)
    return 1
  })
  g.restore()

  granular(g, 21, { grao: 2 })
  return {
    foto: cv,
    area: faixaCilindro(cx, rx, yCorpo, yB, eT, eB, yT + hl + 0.035 * s, yB - 0.055 * s, 64, 7, 3, W, H),
    recorte: null,
    ls: prata ? { sombra: 80, luz: 85, direcao: 135 } : { sombra: 72, luz: 70, direcao: 135 },
    medidas: { largura: 7.5, altura: 9, profundidade: 7.5 },
  }
}

// ── BARBANTE / CORDA TORCIDA ─────────────────────────────────────────────────────────────────────
function corda(g: CanvasRenderingContext2D, pts: Ponto[], r: number, cor: number[], passo: number, escuro = 1) {
  tubo(g, pts, () => r, (nx, ny, nz, _t, arco, lado, _x, _y, o) => {
    luzFosca(nx, ny, nz)
    const f = 0.5 + 0.5 * Math.cos(2 * Math.PI * (arco / passo + lado * 0.45))
    const k = _k * (1 - 0.32 * f ** 2.5) * escuro
    o[0] = cl(cor[0] * k, 0, 255); o[1] = cl(cor[1] * k, 0, 255); o[2] = cl(cor[2] * k, 0, 255)
  })
}

// ── TAG ────────────────────────────────────────────────────────────────────────────────────────
function gerarTag(lado: number): ProdutoGerado {
  const W = Math.round(lado * 0.74), H = lado, u1 = lado / 1000
  const cv = tela(W, H), g = ctx2d(cv)
  // tag plana (5×9 cm)
  const tw = Math.round(0.42 * lado), th = Math.round(tw * 1.8)
  const pl = tela(tw, th), p = ctx2d(pl)
  const ch = 0.2 * tw, rr = 0.035 * tw, hy = 0.17 * tw, hr = 0.052 * tw
  const forma = () => {
    p.beginPath(); p.moveTo(ch, 0); p.lineTo(tw - ch, 0); p.lineTo(tw, ch); p.lineTo(tw, th - rr); p.quadraticCurveTo(tw, th, tw - rr, th)
    p.lineTo(rr, th); p.quadraticCurveTo(0, th, 0, th - rr); p.lineTo(0, ch); p.closePath()
  }
  forma(); p.fillStyle = '#fbfaf7'; p.fill()
  p.save(); forma(); p.clip()
  const gh = p.createLinearGradient(0, 0, tw, 0) // leve curvatura do cartão
  gh.addColorStop(0, 'rgba(0,0,0,0.035)'); gh.addColorStop(0.4, 'rgba(0,0,0,0)'); gh.addColorStop(1, 'rgba(0,0,0,0.075)')
  p.fillStyle = gh; p.fillRect(0, 0, tw, th)
  const gv = p.createLinearGradient(0, 0, 0, th)
  gv.addColorStop(0, 'rgba(255,255,255,0.3)'); gv.addColorStop(1, 'rgba(0,0,0,0.04)')
  p.fillStyle = gv; p.fillRect(0, 0, tw, th)
  p.strokeStyle = 'rgba(90,85,75,0.28)'; p.lineWidth = 2 * u1; forma(); p.stroke()
  p.restore()
  // furo
  p.save(); p.globalCompositeOperation = 'destination-out'; p.beginPath(); p.arc(tw / 2, hy, hr, 0, Math.PI * 2); p.fill(); p.restore()
  p.strokeStyle = 'rgba(80,72,60,0.35)'; p.lineWidth = 1.6 * u1; p.beginPath(); p.arc(tw / 2, hy, hr + 0.6 * u1, 0, Math.PI * 2); p.stroke()
  granular(p, 31, { grao: 5, mancha: 6, escala: 18 * u1, fibra: 3 })

  // posição final: leve giro + perspectiva
  const c = { x: 0.5 * W, y: 0.595 * H }, hh = 0.36 * H, hw = hh / 1.8, a = (-6 * Math.PI) / 180
  const rot = (x: number, y: number, k: number) => ({ x: c.x + x * Math.cos(a) - y * k * Math.sin(a), y: c.y + x * Math.sin(a) + y * k * Math.cos(a) })
  const TL = rot(-hw, -hh, 1), TR = rot(hw * 0.97, -hh, 0.955), BR = rot(hw * 0.97, hh, 0.955), BL = rot(-hw, hh, 1)
  const Hm = homografia(TL, TR, BR, BL)
  const r = distorcer(pl, tw, th, { tipo: 'perspectiva', cols: 2, rows: 2, pontos: [TL, TR, BL, BR] })
  const tag = tela(W, H), tg = ctx2d(tag)
  tg.drawImage(r.canvas, r.minX, r.minY, r.canvas.width / r.escala, r.canvas.height / r.escala)

  const hc = Hm(0.5, (hy + hr * 0.55) / th), K = { x: hc.x + 0.05 * W, y: 0.07 * H }
  const cor = [214, 196, 168], rc = 4.2 * u1
  // fio de trás (passa pelo furo)
  corda(g, bezier(hc, { x: hc.x + 0.13 * W, y: hc.y - 0.06 * H }, { x: K.x + 0.05 * W, y: K.y + 0.07 * H }, K, 70), rc, cor, 11 * u1, 0.86)
  // espessura do cartão + cartão
  const esp = tela(W, H), eg = ctx2d(esp)
  eg.drawImage(tag, 0, 0); eg.globalCompositeOperation = 'source-in'; eg.fillStyle = '#d6d2c8'; eg.fillRect(0, 0, W, H)
  g.drawImage(esp, 1.6 * u1, 3 * u1)
  g.drawImage(tag, 0, 0)
  // fio da frente: sombra de contato só sobre o cartão
  const frente = bezier(hc, { x: hc.x - 0.1 * W, y: hc.y - 0.07 * H }, { x: K.x - 0.08 * W, y: K.y + 0.06 * H }, K, 70)
  g.save(); g.globalCompositeOperation = 'source-atop'
  tracoSuave(g, () => { g.beginPath(); g.moveTo(frente[0].x + 3 * u1, frente[0].y + 5 * u1); for (const q of frente) g.lineTo(q.x + 3 * u1, q.y + 5 * u1); g.stroke() }, 'rgba(60,50,35,0.35)', rc * 1.6, 6 * u1)
  g.restore()
  corda(g, frente, rc, cor, 11 * u1)
  // nó + pontas
  corda(g, bezier(K, { x: K.x - 0.06 * W, y: K.y + 0.01 * H }, { x: K.x - 0.12 * W, y: K.y + 0.05 * H }, { x: K.x - 0.15 * W, y: K.y + 0.12 * H }, 50), rc, cor, 11 * u1)
  corda(g, bezier(K, { x: K.x + 0.05 * W, y: K.y }, { x: K.x + 0.1 * W, y: K.y + 0.05 * H }, { x: K.x + 0.11 * W, y: K.y + 0.13 * H }, 50), rc, cor, 11 * u1)
  corda(g, bezier({ x: K.x - 1.8 * rc, y: K.y + rc }, { x: K.x - rc, y: K.y - 2.2 * rc }, { x: K.x + rc, y: K.y - 2.2 * rc }, { x: K.x + 1.8 * rc, y: K.y + rc }, 30), rc * 1.25, cor, 9 * u1)

  const pts = [Hm(0.1, 0.24), Hm(0.9, 0.24), Hm(0.1, 0.94), Hm(0.9, 0.94)]
  return {
    foto: cv,
    area: { tipo: 'perspectiva', cols: 2, rows: 2, pontos: norm(pts, W, H) },
    recorte: null,
    ls: { sombra: 60, luz: 25, direcao: 135 },
    medidas: { largura: 5, altura: 9, profundidade: null },
  }
}

// ── TOPO DE BOLO (cartão festonado no palito, sobre bolo branco) ─────────────────────────────────
function gerarTopo(lado: number): ProdutoGerado {
  const s = lado, W = Math.round(lado * 0.8), H = lado, u1 = lado / 1000
  const cv = tela(W, H), g = ctx2d(cv)
  const cx = W / 2, rx = 0.42 * W, eT = 0.24 * rx, eB = 0.27 * rx
  const yB = 0.885 * H, yT = yB - 0.23 * H
  // base (disco do bolo)
  const rb = rx * 1.13, eb = eB * 1.13
  cilindro(g, cx, rb, yB, yB + 0.016 * s, eb, eb * 1.02, (u, _v, _x, _y, o) => { luzBrilho(u, 0.2, Math.sqrt(1 - u * u), 0.6); tom(o, 238, 238, 236, _k, _s) })
  g.save(); g.beginPath(); g.ellipse(cx, yB, rb, eb, 0, 0, Math.PI * 2)
  const gb = g.createLinearGradient(cx - rb, yB - eb, cx + rb, yB + eb)
  gb.addColorStop(0, '#fbfbfa'); gb.addColorStop(1, '#dcdcda'); g.fillStyle = gb; g.fill(); g.restore()
  // laterais do bolo (glacê fosco com marcas de espátula)
  cilindro(g, cx, rx, yT, yB, eT, eB, (u, v, x, y, o) => {
    const nz = Math.sqrt(1 - u * u)
    const nx = u + (fbm(x / (0.03 * s), y / (0.02 * s), 41, 3) - 0.5) * 0.1
    const ny = (fbm(x / (0.2 * s), y / (0.01 * s), 43, 2) - 0.5) * 0.12 + (v < 0.06 ? -0.5 * (1 - v / 0.06) : 0)
    const L = Math.hypot(nx, ny, nz)
    luzFosca(nx / L, ny / L, nz / L)
    tom(o, 253, 251, 248, _k * (1 - 0.06 * suave(0.85, 1, v)), 0.04 * gauss(u, -0.5, 0.3))
  })
  // topo do bolo
  g.save(); g.beginPath(); g.ellipse(cx, yT, rx, eT, 0, 0, Math.PI * 2); g.clip()
  pintar(g, cx - rx, yT - eT, cx + rx, yT + eT, (x, y, o) => {
    const dx = (x - cx) / rx, dy = (y - yT) / eT
    const k = 0.955 - 0.05 * dx - 0.02 * dy + (fbm(x / (0.05 * s), y / (0.02 * s), 47, 3) - 0.5) * 0.06 - 0.06 * suave(0.85, 1, Math.hypot(dx, dy))
    tom(o, 253, 251, 248, k, 0)
    return 1
  })
  g.restore()
  // bolinhas de glacê (borda de cima e de baixo)
  const bolinha = (x: number, y: number, r: number) => {
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r)
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#f4f3f0'); gr.addColorStop(1, '#c9c8c4')
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * 0.92, 0, 0, Math.PI * 2); g.fill()
  }
  const rbTop = 0.026 * s, nTop = 34, top: Ponto[] = []
  for (let i = 0; i < nTop; i++) { const a = (i / nTop) * Math.PI * 2; top.push({ x: cx + rx * 0.95 * Math.cos(a), y: yT + eT * 0.95 * Math.sin(a) - rbTop * 0.55 }) }
  top.sort((p1, p2) => p1.y - p2.y).forEach(q => bolinha(q.x, q.y, rbTop))
  const rbBot = 0.03 * s
  const bot: Ponto[] = []
  for (let i = 0; i <= 22; i++) { const a = Math.PI * (0.03 + (0.94 * i) / 22); bot.push({ x: cx + rx * Math.cos(a), y: yB + eB * Math.sin(a) - rbBot * 0.5 }) }
  bot.sort((p1, p2) => p1.y - p2.y).forEach(q => bolinha(q.x, q.y, rbBot))

  // palito + cartão
  const R = 0.265 * W, cc = { x: cx, y: 0.3 * H }, base = { x: cx + 0.01 * W, y: yT + 0.15 * eT }
  g.save(); g.fillStyle = 'rgba(120,112,100,0.35)'; g.beginPath(); g.ellipse(base.x, base.y + 1.5 * u1, 13 * u1, 5 * u1, 0, 0, Math.PI * 2); g.fill(); g.restore()
  tubo(g, [{ x: cc.x, y: cc.y + R * 0.3 }, base], () => 6.5 * u1, (nx, ny, nz, _t, _a, _l, _x, y, o) => {
    luzFosca(nx, ny, nz); tom(o, 250, 249, 246, _k * (1 - 0.3 * suave(base.y - 8 * u1, base.y, y)), 0.1 * gauss(nx, -0.5, 0.2))
  })
  const n = 26, festao = (gg: CanvasRenderingContext2D, ox: number, oy: number) => {
    gg.beginPath()
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2
      if (i === 0) gg.moveTo(cc.x + ox + R * 0.94 * Math.cos(a0), cc.y + oy + R * 0.94 * Math.sin(a0))
      gg.quadraticCurveTo(cc.x + ox + R * 1.1 * Math.cos(am), cc.y + oy + R * 1.1 * Math.sin(am), cc.x + ox + R * 0.94 * Math.cos(a1), cc.y + oy + R * 0.94 * Math.sin(a1))
    }
    gg.closePath()
  }
  const card = tela(W, H), kg = ctx2d(card)
  festao(kg, 3 * u1, 5 * u1); kg.fillStyle = '#d4d0c7'; kg.fill()      // espessura do papel
  festao(kg, 0, 0); kg.fillStyle = '#fbfaf8'; kg.fill()
  kg.save(); festao(kg, 0, 0); kg.clip()
  const gc = kg.createLinearGradient(cc.x - R, cc.y - R, cc.x + R, cc.y + R)
  gc.addColorStop(0, 'rgba(255,255,255,0.12)'); gc.addColorStop(0.5, 'rgba(0,0,0,0)'); gc.addColorStop(1, 'rgba(0,0,0,0.06)')
  kg.fillStyle = gc; kg.fillRect(0, 0, W, H)
  kg.strokeStyle = 'rgba(90,85,75,0.3)'; kg.lineWidth = 2 * u1; festao(kg, 0, 0); kg.stroke()
  kg.restore()
  granular(kg, 51, { grao: 5, mancha: 5, escala: 16 * u1, fibra: 2.5 })
  g.drawImage(card, 0, 0)

  const ri = R * 0.88
  return {
    foto: cv,
    area: { tipo: 'perspectiva', cols: 2, rows: 2, pontos: norm([{ x: cc.x - ri, y: cc.y - ri }, { x: cc.x + ri, y: cc.y - ri }, { x: cc.x - ri, y: cc.y + ri }, { x: cc.x + ri, y: cc.y + ri }], W, H) },
    recorte: { forma: 'elipse', x: +((cc.x - ri) / W).toFixed(5), y: +((cc.y - ri) / H).toFixed(5), w: +((2 * ri) / W).toFixed(5), h: +((2 * ri) / H).toFixed(5) },
    ls: { sombra: 60, luz: 25, direcao: 135 },
    medidas: { largura: 12, altura: 20, profundidade: null },
  }
}

// ── CAMISETA INFANTIL (flat lay) ─────────────────────────────────────────────────────────────────
function gerarCamiseta(lado: number): ProdutoGerado {
  const W = lado, H = lado, s = lado / 1000
  const cv = tela(W, H), g = ctx2d(cv)
  const P = (x: number, y: number) => [x * s, y * s] as [number, number]
  const contorno = (gg: CanvasRenderingContext2D) => {
    gg.beginPath(); gg.moveTo(...P(388, 92))
    gg.quadraticCurveTo(...P(500, 102), ...P(612, 92))
    gg.quadraticCurveTo(...P(700, 118), ...P(785, 150))
    gg.quadraticCurveTo(...P(890, 222), ...P(968, 352))
    gg.lineTo(...P(878, 440))
    gg.quadraticCurveTo(...P(835, 402), ...P(792, 378))
    gg.bezierCurveTo(...P(784, 560), ...P(795, 760), ...P(800, 885))
    gg.quadraticCurveTo(...P(500, 899), ...P(200, 885))
    gg.bezierCurveTo(...P(205, 760), ...P(216, 560), ...P(208, 378))
    gg.quadraticCurveTo(...P(165, 402), ...P(122, 440))
    gg.lineTo(...P(32, 352))
    gg.quadraticCurveTo(...P(110, 222), ...P(215, 150))
    gg.quadraticCurveTo(...P(300, 118), ...P(388, 92))
    gg.closePath()
  }
  contorno(g); g.fillStyle = 'rgb(238,238,236)'; g.fill()
  g.save(); contorno(g); g.clip()
  // luz geral
  const gl = g.createLinearGradient(0, 0, W, H)
  gl.addColorStop(0, 'rgba(255,255,255,0.5)'); gl.addColorStop(0.55, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(70,75,85,0.07)')
  g.fillStyle = gl; g.fillRect(0, 0, W, H)
  // abertura da gola: avesso das costas na sombra + ribana de trás
  const golaInt = () => { g.beginPath(); g.moveTo(...P(388, 92)); g.quadraticCurveTo(...P(500, 102), ...P(612, 92)); g.lineTo(...P(590, 95)); g.quadraticCurveTo(...P(500, 206), ...P(410, 95)); g.closePath() }
  golaInt(); const gi = g.createLinearGradient(0, 95 * s, 0, 160 * s)
  gi.addColorStop(0, 'rgb(236,236,234)'); gi.addColorStop(0.28, 'rgb(226,226,225)'); gi.addColorStop(0.32, 'rgb(205,206,208)'); gi.addColorStop(1, 'rgb(178,180,184)')
  g.fillStyle = gi; g.fill()
  // ribana da frente
  const ribana = () => { g.beginPath(); g.moveTo(...P(386, 91)); g.quadraticCurveTo(...P(500, 262), ...P(614, 91)); g.lineTo(...P(590, 95)); g.quadraticCurveTo(...P(500, 206), ...P(410, 95)); g.closePath() }
  ribana(); g.fillStyle = 'rgb(247,247,245)'; g.fill()
  g.save(); ribana(); g.clip()
  g.strokeStyle = 'rgba(120,125,130,0.10)'; g.lineWidth = 1.2 * s
  for (let i = 0; i <= 90; i++) { // canelado perpendicular à gola
    const t = i / 90, a = { x: (1 - t) ** 2 * 386 + 2 * (1 - t) * t * 500 + t * t * 614, y: (1 - t) ** 2 * 91 + 2 * (1 - t) * t * 262 + t * t * 91 }
    const b = { x: (1 - t) ** 2 * 410 + 2 * (1 - t) * t * 500 + t * t * 590, y: (1 - t) ** 2 * 95 + 2 * (1 - t) * t * 206 + t * t * 95 }
    g.beginPath(); g.moveTo(a.x * s, a.y * s); g.lineTo(b.x * s, b.y * s); g.stroke()
  }
  g.restore()
  tracoSuave(g, () => { g.beginPath(); g.moveTo(...P(410, 95)); g.quadraticCurveTo(...P(500, 206), ...P(590, 95)); g.stroke() }, 'rgba(90,95,105,0.35)', 3 * s, 5 * s)
  tracoSuave(g, () => { g.beginPath(); g.moveTo(...P(392, 96)); g.quadraticCurveTo(...P(500, 264), ...P(608, 96)); g.stroke() }, 'rgba(90,95,105,0.22)', 3 * s, 7 * s)

  // dobras do tecido (sombra + luz ao lado)
  const dobra = (pts: number[], larg: number, alfa: number) => {
    const cam = (dx: number, dy: number) => { g.beginPath(); g.moveTo((pts[0] + dx) * s, (pts[1] + dy) * s); g.bezierCurveTo((pts[2] + dx) * s, (pts[3] + dy) * s, (pts[4] + dx) * s, (pts[5] + dy) * s, (pts[6] + dx) * s, (pts[7] + dy) * s); g.stroke() }
    // crista: luz do lado de cima/esquerda, sombra do outro lado
    const dl = Math.hypot(pts[6] - pts[0], pts[7] - pts[1]) || 1
    let nx = -(pts[7] - pts[1]) / dl, ny = (pts[6] - pts[0]) / dl
    if (nx + ny > 0) { nx = -nx; ny = -ny }
    tracoSuave(g, () => cam(nx * larg * 0.9, ny * larg * 0.9), `rgba(255,255,255,${alfa * 0.6})`, larg * 0.9 * s, larg * 1.4 * s)
    g.save(); g.globalCompositeOperation = 'multiply'
    tracoSuave(g, () => cam(-nx * larg * 0.6, -ny * larg * 0.6), `rgba(160,166,178,${alfa * 0.55})`, larg * 1.6 * s, larg * 2 * s)
    tracoSuave(g, () => cam(0, 0), `rgba(170,175,186,${alfa * 0.45})`, larg * 0.3 * s, larg * 0.5 * s)
    g.restore()
  }
  dobra([212, 392, 260, 470, 330, 560, 420, 640], 30, 0.7)
  dobra([792, 392, 750, 470, 690, 540, 610, 610], 30, 0.6)
  dobra([230, 820, 300, 780, 380, 790, 460, 850], 28, 0.55)
  dobra([560, 850, 620, 790, 700, 770, 780, 810], 26, 0.5)
  dobra([205, 165, 160, 215, 120, 275, 85, 335], 18, 0.45)
  dobra([798, 168, 845, 218, 885, 275, 918, 335], 18, 0.4)
  dobra([470, 640, 450, 700, 445, 760, 460, 830], 34, 0.35)
  dobra([690, 230, 715, 300, 712, 360, 700, 410], 26, 0.3)
  dobra([380, 330, 440, 400, 520, 470, 610, 520], 30, 0.28) // atravessa a estampa (a arte ganha a dobra)
  // borda enrolada (espessura do tecido)
  tracoSuave(g, () => contorno(g), 'rgba(95,100,110,0.5)', 7 * s, 9 * s)
  // barras com pesponto duplo + costuras do ombro
  g.setLineDash([5 * s, 3.2 * s]); g.strokeStyle = 'rgba(130,134,140,0.45)'; g.lineWidth = 1.3 * s
  const pesp = (a: number[], b: number[], nx: number, ny: number) => {
    for (const o of [22, 29]) { g.beginPath(); g.moveTo((a[0] + nx * o) * s, (a[1] + ny * o) * s); g.lineTo((b[0] + nx * o) * s, (b[1] + ny * o) * s); g.stroke() }
  }
  g.beginPath(); for (const o of [22, 29]) { g.moveTo(203 * s, (885 - o) * s); g.quadraticCurveTo(500 * s, (899 - o) * s, 797 * s, (885 - o) * s) } g.stroke()
  pesp([968, 352], [878, 440], -0.7, -0.71); pesp([32, 352], [122, 440], 0.7, -0.71)
  g.setLineDash([])
  tracoSuave(g, () => { g.beginPath(); g.moveTo(203 * s, 856 * s); g.quadraticCurveTo(500 * s, 870 * s, 797 * s, 856 * s); g.stroke() }, 'rgba(120,125,135,0.25)', 2 * s, 3 * s)
  g.strokeStyle = 'rgba(140,144,150,0.22)'; g.lineWidth = 1.4 * s
  g.beginPath(); g.moveTo(...P(614, 92)); g.quadraticCurveTo(...P(700, 119), ...P(785, 151)); g.stroke()
  g.beginPath(); g.moveTo(...P(386, 92)); g.quadraticCurveTo(...P(300, 119), ...P(215, 151)); g.stroke()
  g.beginPath(); g.moveTo(...P(795, 378)); g.quadraticCurveTo(...P(800, 260), ...P(785, 152)); g.stroke()
  g.beginPath(); g.moveTo(...P(205, 378)); g.quadraticCurveTo(...P(200, 260), ...P(215, 152)); g.stroke()
  g.restore()
  // malha: fio vertical + granulado
  granular(g, 61, { grao: 4, fibra: 5, fibraV: true, mancha: 3, escala: 30 * s })

  const A = [[360, 250], [500, 255], [640, 248], [357, 396], [500, 400], [643, 394], [362, 542], [500, 547], [638, 540]]
  return {
    foto: cv,
    area: { tipo: 'malha', cols: 3, rows: 3, pontos: A.map(([x, y]) => ({ x: x / 1000, y: y / 1000 })) },
    recorte: null,
    ls: { sombra: 80, luz: 30, direcao: 135 },
    medidas: { largura: 36, altura: 46, profundidade: null },
  }
}

// ── SACOLINHA DE PAPEL (branca ou kraft) ─────────────────────────────────────────────────────────
function gerarSacola(lado: number, kraft: boolean): ProdutoGerado {
  const W = Math.round(lado * 0.8), H = lado, u1 = lado / 1000
  const cv = tela(W, H), g = ctx2d(cv)
  const X = (v: number) => v * W, Y = (v: number) => v * H
  const base = kraft ? [201, 165, 124] : [250, 249, 246]
  const rgb = (k: number) => `rgb(${cl(base[0] * k, 0, 255) | 0},${cl(base[1] * k, 0, 255) | 0},${cl(base[2] * k, 0, 255) | 0})`
  const TL = { x: X(0.08), y: Y(0.36) }, TR = { x: X(0.7), y: Y(0.372) }, BR = { x: X(0.7), y: Y(0.955) }, BL = { x: X(0.08), y: Y(0.948) }
  const V = { x: X(0.782), y: Y(0.398) }, TB = { x: X(0.875), y: Y(0.338) }, BB = { x: X(0.875), y: Y(0.925) }, TBL = { x: X(0.17), y: Y(0.328) }
  // interior (avesso das costas na sombra)
  poligono(g, [TL, TR, V, TB, TBL])
  const gi = g.createLinearGradient(0, Y(0.33), 0, Y(0.37)); gi.addColorStop(0, rgb(0.8)); gi.addColorStop(1, rgb(0.5))
  g.fillStyle = gi; g.fill()
  // alças de papel torcido
  const cordaCor = kraft ? [190, 152, 110] : [246, 245, 242]
  corda(g, bezier({ x: X(0.35), y: Y(0.37) }, { x: X(0.35), y: Y(0.06) }, { x: X(0.69), y: Y(0.06) }, { x: X(0.69), y: Y(0.36) }, 90), 7 * u1, cordaCor, 16 * u1, 0.8)
  corda(g, bezier({ x: X(0.22), y: Y(0.42) }, { x: X(0.21), y: Y(0.09) }, { x: X(0.57), y: Y(0.09) }, { x: X(0.56), y: Y(0.42) }, 90), 7.5 * u1, cordaCor, 16 * u1)
  // frente
  poligono(g, [TL, TR, BR, BL]); g.fillStyle = rgb(0.985); g.fill()
  g.save(); poligono(g, [TL, TR, BR, BL]); g.clip()
  const gf = g.createLinearGradient(TL.x, 0, TR.x, 0); gf.addColorStop(0, 'rgba(255,255,255,0.25)'); gf.addColorStop(0.5, 'rgba(0,0,0,0)'); gf.addColorStop(1, 'rgba(0,0,0,0.06)')
  g.fillStyle = gf; g.fillRect(0, 0, W, H)
  const gv = g.createLinearGradient(0, TL.y, 0, BL.y); gv.addColorStop(0, 'rgba(0,0,0,0.05)'); gv.addColorStop(0.08, 'rgba(0,0,0,0)'); gv.addColorStop(0.9, 'rgba(0,0,0,0)'); gv.addColorStop(1, 'rgba(0,0,0,0.05)')
  g.fillStyle = gv; g.fillRect(0, 0, W, H)
  // aba interna da boca (vinco) e rugas suaves
  tracoSuave(g, () => { g.beginPath(); g.moveTo(TL.x, TL.y + Y(0.045)); g.lineTo(TR.x, TR.y + Y(0.045)); g.stroke() }, 'rgba(0,0,0,0.10)', 2 * u1, 4 * u1)
  tracoSuave(g, () => { g.beginPath(); g.moveTo(TL.x, TL.y + Y(0.049)); g.lineTo(TR.x, TR.y + Y(0.049)); g.stroke() }, 'rgba(255,255,255,0.5)', 2 * u1, 3 * u1)
  for (const [x0, a] of [[0.22, 0.05], [0.47, 0.04], [0.61, 0.05]] as const) {
    tracoSuave(g, () => { g.beginPath(); g.moveTo(X(x0), Y(0.42)); g.quadraticCurveTo(X(x0 + 0.015), Y(0.65), X(x0 - 0.005), Y(0.9)); g.stroke() }, `rgba(0,0,0,${a})`, 10 * u1, 16 * u1)
  }
  g.restore()
  // lateral sanfonada (vinco em V)
  const Mc = { x: X(0.786), y: Y(0.8) }
  poligono(g, [TR, V, Mc, BR]); g.fillStyle = rgb(0.8); g.fill()
  poligono(g, [V, TB, BB, Mc]); g.fillStyle = rgb(0.9); g.fill()
  poligono(g, [BR, Mc, BB]); g.fillStyle = rgb(0.85); g.fill()
  g.save(); poligono(g, [TR, V, TB, BB, BR]); g.clip()
  const gs = g.createLinearGradient(0, Y(0.35), 0, Y(0.95)); gs.addColorStop(0, 'rgba(0,0,0,0.06)'); gs.addColorStop(1, 'rgba(255,255,255,0.06)')
  g.fillStyle = gs; g.fillRect(0, 0, W, H)
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5 * u1; g.beginPath(); g.moveTo(V.x, V.y); g.lineTo(Mc.x, Mc.y); g.stroke()
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.moveTo(BR.x, BR.y); g.lineTo(Mc.x, Mc.y); g.lineTo(BB.x, BB.y); g.stroke()
  g.restore()
  // quina da frente pega luz
  g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.5 * u1; g.beginPath(); g.moveTo(TR.x, TR.y); g.lineTo(BR.x, BR.y); g.stroke()
  granular(g, kraft ? 71 : 73, kraft ? { grao: 9, mancha: 12, escala: 22 * u1, fibra: 5, fibraV: true } : { grao: 5, mancha: 5, escala: 20 * u1, fibra: 3 })

  const q = [TL, TR, BR, BL]
  const pts = [bilinear(q, 0.08, 0.16), bilinear(q, 0.92, 0.16), bilinear(q, 0.08, 0.93), bilinear(q, 0.92, 0.93)]
  return {
    foto: cv,
    area: { tipo: 'perspectiva', cols: 2, rows: 2, pontos: norm(pts, W, H) },
    recorte: null,
    ls: { sombra: 65, luz: 20, direcao: 135 },
    medidas: { largura: 15, altura: 20, profundidade: 8 },
  }
}

export const PRODUTOS_ACERVO: ProdutoAcervo[] = [
  { id: 'caneca', nome: 'Caneca de cerâmica', categoria: 'caneca', gerar: gerarCaneca },
  { id: 'lata', nome: 'Latinha branca', categoria: 'lata', gerar: l => gerarLata(l, false) },
  { id: 'lata-prata', nome: 'Latinha prata', categoria: 'lata', gerar: l => gerarLata(l, true) },
  { id: 'tag', nome: 'Tag com barbante', categoria: 'tag', gerar: gerarTag },
  { id: 'topo', nome: 'Topo de bolo', categoria: 'topo', gerar: gerarTopo },
  { id: 'camiseta', nome: 'Camiseta infantil', categoria: 'camiseta', gerar: gerarCamiseta },
  { id: 'sacolinha-papel', nome: 'Sacolinha de papel branca', categoria: 'sacola', gerar: l => gerarSacola(l, false) },
  { id: 'sacolinha-kraft', nome: 'Sacolinha kraft', categoria: 'sacola', gerar: l => gerarSacola(l, true) },
]

