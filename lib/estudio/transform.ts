// SOA Edition — TRANSFORMAÇÕES de imagem: perspectiva (4 pontos) e warp por malha (superfícies
// curvas: caneca, garrafa, almofada). Utilitário COMPARTILHADO: o editor de camadas usa agora e o
// Mockup (Fase 3) vai usar para "encaixar a arte no produto".
//
// Como funciona: a imagem vira uma malha densa de triângulos; cada vértice da malha vai para a
// posição calculada (homografia na perspectiva; interpolação suave Catmull-Rom na malha) e a GPU
// (WebGL) desenha a textura esticada. Sem WebGL, o mesmo resultado sai triângulo a triângulo no
// canvas 2D (mais lento, mas igual). Só navegador.

export type Ponto = { x: number; y: number }

/** Distorção guardada na camada, em PIXELS DA IMAGEM ORIGINAL (não da tela). */
export interface Distorcao {
  tipo: 'perspectiva' | 'malha'
  /** Pontos de controle por linha (perspectiva: 2×2 = cantos TL, TR, BL, BR). */
  cols: number
  rows: number
  pontos: Ponto[]
}

/** Grade de controle "sem distorção" sobre uma imagem w×h. */
export function gradeNeutra(w: number, h: number, cols: number, rows: number): Ponto[] {
  const out: Ponto[] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: (c / (cols - 1)) * w, y: (r / (rows - 1)) * h })
  return out
}

/** Homografia do quadrado unitário para o quadrilátero (TL, TR, BR, BL) — Heckbert. */
function homografiaUnitaria(q: [Ponto, Ponto, Ponto, Ponto]): number[] {
  const [p0, p1, p2, p3] = q
  const sx = p0.x - p1.x + p2.x - p3.x, sy = p0.y - p1.y + p2.y - p3.y
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
    return [p1.x - p0.x, p2.x - p1.x, p0.x, p1.y - p0.y, p2.y - p1.y, p0.y, 0, 0, 1]
  }
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dy1 = p1.y - p2.y, dy2 = p3.y - p2.y
  const den = dx1 * dy2 - dx2 * dy1
  const g = (sx * dy2 - dx2 * sy) / den, h = (dx1 * sy - sx * dy1) / den
  return [p1.x - p0.x + g * p1.x, p3.x - p0.x + h * p3.x, p0.x, p1.y - p0.y + g * p1.y, p3.y - p0.y + h * p3.y, p0.y, g, h, 1]
}
const aplicarH = (H: number[], u: number, v: number): Ponto => {
  const w = H[6] * u + H[7] * v + H[8]
  return { x: (H[0] * u + H[1] * v + H[2]) / w, y: (H[3] * u + H[4] * v + H[5]) / w }
}

const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)

/** Posição na malha de controle (u,v ∈ [0,1]) — bilinear em 2×2, Catmull-Rom (suave) acima disso. */
function naMalha(d: Distorcao, u: number, v: number): Ponto {
  const { cols, rows, pontos } = d
  // Fora da grade: pontos-fantasma por EXTRAPOLAÇÃO linear (repetir a borda entortaria a malha
  // mesmo sem distorção). Assim, grade reta → imagem intacta.
  const Q = (c: number, r: number) => pontos[r * cols + c]
  const P = (c: number, r: number): Ponto => {
    if (r < 0) { const a = P(c, 0), b = P(c, 1); return { x: 2 * a.x - b.x, y: 2 * a.y - b.y } }
    if (r > rows - 1) { const a = P(c, rows - 1), b = P(c, rows - 2); return { x: 2 * a.x - b.x, y: 2 * a.y - b.y } }
    if (c < 0) { const a = Q(0, r), b = Q(1, r); return { x: 2 * a.x - b.x, y: 2 * a.y - b.y } }
    if (c > cols - 1) { const a = Q(cols - 1, r), b = Q(cols - 2, r); return { x: 2 * a.x - b.x, y: 2 * a.y - b.y } }
    return Q(c, r)
  }
  const fx = u * (cols - 1), fy = v * (rows - 1)
  const c = Math.min(cols - 2, Math.floor(fx)), r = Math.min(rows - 2, Math.floor(fy))
  const tu = fx - c, tv = fy - r
  if (cols === 2 && rows === 2) {
    const a = P(0, 0), b = P(1, 0), cc = P(0, 1), dd = P(1, 1)
    return { x: (a.x * (1 - tu) + b.x * tu) * (1 - tv) + (cc.x * (1 - tu) + dd.x * tu) * tv, y: (a.y * (1 - tu) + b.y * tu) * (1 - tv) + (cc.y * (1 - tu) + dd.y * tu) * tv }
  }
  const linha = (rr: number, k: 'x' | 'y') => catmull(P(c - 1, rr)[k], P(c, rr)[k], P(c + 1, rr)[k], P(c + 2, rr)[k], tu)
  const col = (k: 'x' | 'y') => catmull(linha(r - 1, k), linha(r, k), linha(r + 1, k), linha(r + 2, k), tv)
  return { x: col('x'), y: col('y') }
}

/** Malha DENSA de destino (sub×sub células) para a distorção. */
export function malhaDensa(d: Distorcao, sub = 32): { n: number; pts: Ponto[] } {
  const pts: Ponto[] = []
  const H = d.tipo === 'perspectiva' ? homografiaUnitaria([d.pontos[0], d.pontos[1], d.pontos[3], d.pontos[2]]) : null
  for (let j = 0; j <= sub; j++) for (let i = 0; i <= sub; i++) {
    const u = i / sub, v = j / sub
    pts.push(H ? aplicarH(H, u, v) : naMalha(d, u, v))
  }
  return { n: sub, pts }
}

export interface ResultadoDistorcao {
  canvas: HTMLCanvasElement
  /** Canto superior esquerdo do resultado, no espaço da imagem original. */
  minX: number
  minY: number
  /** < 1 quando o resultado precisou ser reduzido (limite de pixels); a camada compensa na escala. */
  escala: number
}

const MAX_AREA = 16_000_000

let glCache: { cv: HTMLCanvasElement; gl: WebGLRenderingContext; prog: WebGLProgram; max: number } | null | undefined

function obterGL() {
  if (glCache !== undefined) return glCache
  try {
    const cv = document.createElement('canvas')
    const gl = cv.getContext('webgl', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: true }) as WebGLRenderingContext | null
    if (!gl) return (glCache = null)
    const sh = (t: number, src: string) => { const s = gl.createShader(t)!; gl.shaderSource(s, src); gl.compileShader(s); return s }
    const prog = gl.createProgram()!
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 p;attribute vec2 t;uniform vec2 r;varying vec2 v;void main(){v=t;gl_Position=vec4(p/r*2.0-1.0,0,1);gl_Position.y=-gl_Position.y;}'))
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, 'precision highp float;varying vec2 v;uniform sampler2D s;void main(){gl_FragColor=texture2D(s,v);}'))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return (glCache = null)
    return (glCache = { cv, gl, prog, max: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number })
  } catch { return (glCache = null) }
}

/**
 * Aplica a distorção na imagem `src` (w×h). Retorna a imagem distorcida recortada no retângulo
 * que ela ocupa + onde esse retângulo fica no espaço da imagem original.
 */
export function distorcer(src: CanvasImageSource, w: number, h: number, d: Distorcao): ResultadoDistorcao {
  const { n, pts } = malhaDensa(d)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of pts) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y) }
  minX = Math.floor(minX); minY = Math.floor(minY)
  const W0 = Math.max(1, Math.ceil(maxX - minX)), H0 = Math.max(1, Math.ceil(maxY - minY))
  const escala = Math.min(1, Math.sqrt(MAX_AREA / (W0 * H0)), 8000 / Math.max(W0, H0))
  const W = Math.max(1, Math.round(W0 * escala)), H = Math.max(1, Math.round(H0 * escala))
  const dest = pts.map(p => ({ x: (p.x - minX) * escala, y: (p.y - minY) * escala }))

  const out = document.createElement('canvas')
  out.width = W; out.height = H
  const g = obterGL()
  if (g && W <= g.max && H <= g.max) {
    try { desenharGL(g, src, w, h, n, dest, W, H); out.getContext('2d')!.drawImage(g.cv, 0, 0); return { canvas: out, minX, minY, escala } }
    catch { /* cai no 2D */ }
  }
  desenhar2D(out, src, w, h, n, dest)
  return { canvas: out, minX, minY, escala }
}

function desenharGL(g: NonNullable<typeof glCache>, src: CanvasImageSource, w: number, h: number, n: number, dest: Ponto[], W: number, H: number) {
  const { gl, cv, prog } = g
  cv.width = W; cv.height = H
  gl.viewport(0, 0, W, H)
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT)
  gl.useProgram(prog)
  // Textura (reduz a fonte se passar do limite da GPU).
  let fonte: TexImageSource = src as TexImageSource
  if (Math.max(w, h) > g.max) {
    const k = g.max / Math.max(w, h), c = document.createElement('canvas')
    c.width = Math.floor(w * k); c.height = Math.floor(h * k); c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height); fonte = c
  }
  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fonte)
  for (const [k, v] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]]) gl.texParameteri(gl.TEXTURE_2D, k, v)
  const pos: number[] = [], uv: number[] = []
  const V = (i: number, j: number) => { const p = dest[j * (n + 1) + i]; pos.push(p.x, p.y); uv.push(i / n, j / n) }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { V(i, j); V(i + 1, j); V(i, j + 1); V(i + 1, j); V(i + 1, j + 1); V(i, j + 1) }
  const buf = (dados: number[], nome: string) => {
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(dados), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, nome); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    return b
  }
  const b1 = buf(pos, 'p'), b2 = buf(uv, 't')
  gl.uniform2f(gl.getUniformLocation(prog, 'r'), W, H)
  gl.drawArrays(gl.TRIANGLES, 0, pos.length / 2)
  gl.deleteBuffer(b1); gl.deleteBuffer(b2); gl.deleteTexture(tex)
}

/** Sem WebGL: cada triângulo é um recorte com transformação afim (levemente expandido contra frestas). */
function desenhar2D(out: HTMLCanvasElement, src: CanvasImageSource, w: number, h: number, n: number, dest: Ponto[]) {
  const g = out.getContext('2d')!
  const tri = (s: Ponto[], d: Ponto[]) => {
    const [s0, s1, s2] = s, [d0, d1, d2] = d
    const den = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y)
    if (Math.abs(den) < 1e-9) return
    const a = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / den
    const b = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / den
    const c = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / den
    const dd = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / den
    const e = d0.x - a * s0.x - c * s0.y, f = d0.y - b * s0.x - dd * s0.y
    const cx = (d0.x + d1.x + d2.x) / 3, cy = (d0.y + d1.y + d2.y) / 3
    const ex = (p: Ponto) => ({ x: p.x + Math.sign(p.x - cx) * 0.6, y: p.y + Math.sign(p.y - cy) * 0.6 })
    g.save(); g.beginPath()
    const [q0, q1, q2] = [ex(d0), ex(d1), ex(d2)]
    g.moveTo(q0.x, q0.y); g.lineTo(q1.x, q1.y); g.lineTo(q2.x, q2.y); g.closePath(); g.clip()
    g.setTransform(a, b, c, dd, e, f); g.drawImage(src, 0, 0, w, h); g.restore()
  }
  const S = (i: number, j: number) => ({ x: (i / n) * w, y: (j / n) * h })
  const D = (i: number, j: number) => dest[j * (n + 1) + i]
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    tri([S(i, j), S(i + 1, j), S(i, j + 1)], [D(i, j), D(i + 1, j), D(i, j + 1)])
    tri([S(i + 1, j), S(i + 1, j + 1), S(i, j + 1)], [D(i + 1, j), D(i + 1, j + 1), D(i, j + 1)])
  }
}
