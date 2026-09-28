// SOA Design — NÚCLEO DO MOTOR DE APLIQUES (cálculo puro, sem DOM: roda no Web Worker e em teste).
// PNG → ALFA → SILHUETA (vãos preenchidos) → DISTÂNCIA EUCLIDIANA (Felzenszwalb) → cada camada = silhueta expandida
// N mm (borda antisserrilhada pela própria distância) → PREENCHIMENTO (papel liso com grão e quina, metálico com chanfro
// iluminado, holográfico) → CONTORNO em mm (Moore + Douglas-Peucker) — a geometria fica guardada para o arquivo de corte.

export interface CamadaNucleo {
  /** raio TOTAL da camada em px a partir da silhueta do personagem (0 = a própria silhueta) */
  raio: number
  /** 'mascara' = só o alfa (imagem/textura pintadas fora); 'solido' | 'metal' = o núcleo pinta */
  pinta: 'mascara' | 'solido' | 'metal'
  cor: [number, number, number]
  metal?: 'ouro' | 'prata' | 'rose' | 'holografico'
}
export interface EntradaNucleo { alfa: Uint8ClampedArray; W: number; H: number; pxPorMm: number; camadas: CamadaNucleo[]; preencherVaos: boolean }
export interface SaidaCamada { alfa: Uint8ClampedArray; rgba: Uint8ClampedArray | null; contornos: [number, number][][] }
export interface SaidaNucleo { camadas: SaidaCamada[] }

const INF = 1e20
/** Transformada de distância 1D (Felzenszwalb & Huttenlocher) — distância² exata. */
function dt1(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]) }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF
  }
  k = 0
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const dq = q - v[k]; d[q] = dq * dq + f[v[k]] }
}
/** Distância² de cada pixel até o pixel "alvo" mais próximo (alvo=1). */
export function distancia2(alvo: Uint8Array, W: number, H: number): Float64Array {
  const N = W * H, g = new Float64Array(N), n = Math.max(W, H)
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1)
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) f[y] = alvo[y * W + x] ? 0 : INF
    dt1(f, H, d, v, z)
    for (let y = 0; y < H; y++) g[y * W + x] = d[y]
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) f[x] = g[y * W + x]
    dt1(f, W, d, v, z)
    for (let x = 0; x < W; x++) g[y * W + x] = d[x]
  }
  return g
}

/** Contorno externo (Moore) de cada peça + Douglas-Peucker. Coordenadas em px. */
export function contornos(bin: Uint8Array, W: number, H: number, eps: number, minArea: number): [number, number][][] {
  const rot = new Int32Array(W * H), fila = new Int32Array(W * H), out: [number, number][][] = []
  let n = 0
  const dentro = (x: number, y: number, id: number) => x >= 0 && y >= 0 && x < W && y < H && rot[y * W + x] === id
  for (let s = 0; s < W * H; s++) {
    if (!bin[s] || rot[s]) continue
    n++; let ini = 0, fim = 0, area = 0; rot[s] = n; fila[fim++] = s
    while (ini < fim) {
      const i = fila[ini++], x = i % W; area++
      const vs = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i >= W ? i - W : -1, i < W * H - W ? i + W : -1]
      for (const q of vs) if (q >= 0 && bin[q] && !rot[q]) { rot[q] = n; fila[fim++] = q }
    }
    if (area < minArea) continue
    const DX = [-1, -1, 0, 1, 1, 1, 0, -1], DY = [0, -1, -1, -1, 0, 1, 1, 1]
    const dir = (dx: number, dy: number) => { for (let i = 0; i < 8; i++) if (DX[i] === dx && DY[i] === dy) return i; return 0 }
    const sx = s % W, sy = (s - sx) / W, pts: [number, number][] = [[sx, sy]]
    let cx = sx, cy = sy, bx = sx - 1, by = sy
    for (let passo = 0; passo < 16 * (W + H); passo++) {
      const d0 = dir(Math.sign(bx - cx), Math.sign(by - cy)); let achou = false
      for (let k = 1; k <= 8; k++) {
        const nd = (d0 + k) % 8, nx = cx + DX[nd], ny = cy + DY[nd]
        if (dentro(nx, ny, n)) { const pd = (d0 + k + 7) % 8; bx = cx + DX[pd]; by = cy + DY[pd]; cx = nx; cy = ny; achou = true; break }
      }
      if (!achou || (cx === sx && cy === sy)) break
      pts.push([cx, cy])
    }
    out.push(simplificar(pts, eps))
  }
  return out
}
function simplificar(p: [number, number][], eps: number): [number, number][] {
  if (p.length < 4) return p
  const manter = new Uint8Array(p.length); manter[0] = manter[p.length - 1] = 1
  const pilha: [number, number][] = [[0, p.length - 1]]
  while (pilha.length) {
    const [a, b] = pilha.pop()!, [ax, ay] = p[a], [bx, by] = p[b], L = Math.hypot(bx - ax, by - ay) || 1
    let dm = -1, im = -1
    for (let i = a + 1; i < b; i++) { const d = Math.abs((by - ay) * p[i][0] - (bx - ax) * p[i][1] + bx * ay - by * ax) / L; if (d > dm) { dm = d; im = i } }
    if (dm > eps && im > 0) { manter[im] = 1; pilha.push([a, im], [im, b]) }
  }
  return p.filter((_, i) => manter[i])
}

// ── pintura ────────────────────────────────────────────────────────────────────────────────────────────────────
const PALETAS: Record<string, [number, number, number][]> = {
  ouro: [[122, 90, 23], [201, 161, 59], [246, 226, 122], [184, 137, 43], [255, 243, 184], [140, 106, 30]],
  prata: [[107, 111, 117], [201, 205, 210], [244, 246, 248], [154, 160, 166], [255, 255, 255], [125, 130, 138]],
  rose: [[138, 90, 79], [212, 163, 147], [246, 213, 200], [183, 127, 112], [251, 230, 221], [145, 96, 79]],
}
const ruido = (x: number, y: number) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s) }
function paleta(p: [number, number, number][], t: number): [number, number, number] {
  t = ((t % 1) + 1) % 1
  const f = t * p.length, i = Math.floor(f), k = f - i, a = p[i % p.length], b = p[(i + 1) % p.length], s = k * k * (3 - 2 * k)
  return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s]
}
function hsl(h: number, s: number, l: number): [number, number, number] {
  const f = (n: number) => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) }
  return [f(0), f(8), f(4)]
}

export function processar(e: EntradaNucleo): SaidaNucleo {
  const { alfa, W, H, pxPorMm } = e, N = W * H
  // 1) silhueta (+ vãos fechados: o que o exterior não alcança vira peça)
  const sil = new Uint8Array(N)
  for (let i = 0; i < N; i++) if (alfa[i] >= 110) sil[i] = 1
  if (e.preencherVaos) {
    const ext = new Uint8Array(N), fila = new Int32Array(N); let ini = 0, fim = 0
    const semear = (i: number) => { if (!sil[i] && !ext[i]) { ext[i] = 1; fila[fim++] = i } }
    for (let x = 0; x < W; x++) { semear(x); semear((H - 1) * W + x) }
    for (let y = 0; y < H; y++) { semear(y * W); semear(y * W + W - 1) }
    while (ini < fim) { const i = fila[ini++], x = i % W; if (x > 0) semear(i - 1); if (x < W - 1) semear(i + 1); if (i >= W) semear(i - W); if (i < N - W) semear(i + W) }
    for (let i = 0; i < N; i++) if (!ext[i]) sil[i] = 1
  }
  // 2) distâncias: de fora até a silhueta e de dentro até a borda
  const d2fora = distancia2(sil, W, H)
  const inv = new Uint8Array(N); for (let i = 0; i < N; i++) inv[i] = sil[i] ? 0 : 1
  const d2dentro = distancia2(inv, W, H)
  const dFora = new Float32Array(N), dDentro = new Float32Array(N)
  for (let i = 0; i < N; i++) { dFora[i] = Math.sqrt(d2fora[i]); dDentro[i] = Math.sqrt(d2dentro[i]) }
  const eps = Math.max(0.5, 0.08 * pxPorMm), minArea = Math.max(4, (0.5 * pxPorMm) ** 2)
  const camadas: SaidaCamada[] = []
  for (const c of e.camadas) {
    const R = c.raio
    const a = new Uint8ClampedArray(N), bin = new Uint8Array(N)
    // distância de cada pixel até a BORDA da camada (para a quina/chanfro): >0 dentro
    const borda = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      const dd = sil[i] ? R + dDentro[i] - 0.5 : R - dFora[i]
      borda[i] = dd
      const v = R > 0 ? Math.max(0, Math.min(1, dd + 0.5)) : (c.pinta === 'mascara' ? alfa[i] / 255 : Math.max(0, Math.min(1, dd + 0.5)))
      a[i] = Math.round(v * 255); if (v >= 0.5) bin[i] = 1
    }
    // a camada cortada só tem o contorno EXTERNO: vão fechado que a expansão criou (entre braço e corpo) é papel também
    if (e.preencherVaos && R > 0) {
      const ext = new Uint8Array(N), fila = new Int32Array(N); let ini = 0, fim = 0
      const semear = (i: number) => { if (!bin[i] && !ext[i]) { ext[i] = 1; fila[fim++] = i } }
      for (let x = 0; x < W; x++) { semear(x); semear((H - 1) * W + x) }
      for (let y = 0; y < H; y++) { semear(y * W); semear(y * W + W - 1) }
      while (ini < fim) { const i = fila[ini++], x = i % W; if (x > 0) semear(i - 1); if (x < W - 1) semear(i + 1); if (i >= W) semear(i - W); if (i < N - W) semear(i + W) }
      for (let i = 0; i < N; i++) if (!ext[i] && !bin[i]) { bin[i] = 1; a[i] = 255 }
    }
    let rgba: Uint8ClampedArray | null = null
    if (c.pinta !== 'mascara') {
      // quina/chanfro: distância EXATA até a borda desta camada (a aproximação R − dFora cria um "vale" falso no
      // fundo de reentrâncias — axila, vão entre orelhas — e o brilho estourava ali)
      const fora = new Uint8Array(N); for (let i = 0; i < N; i++) fora[i] = bin[i] ? 0 : 1
      const d2b = distancia2(fora, W, H)
      for (let i = 0; i < N; i++) if (bin[i]) borda[i] = Math.sqrt(d2b[i]) - 0.5
      rgba = new Uint8ClampedArray(N * 4)
      const chanfro = (c.pinta === 'metal' ? 1.1 : 0.45) * pxPorMm
      const lx = -0.55, ly = -0.65, lz = 0.52   // luz de cima-esquerda
      const ang = Math.PI / 6, ca = Math.cos(ang), sa = Math.sin(ang), diag = Math.hypot(W, H)
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x
        if (!a[i]) continue
        const h = (q: number) => Math.min(1, Math.max(0, q) / chanfro)
        const hx = h(borda[Math.min(W - 1, x + 1) + y * W]) - h(borda[Math.max(0, x - 1) + y * W])
        const hy = h(borda[x + Math.min(H - 1, y + 1) * W]) - h(borda[x + Math.max(0, y - 1) * W])
        const k = c.pinta === 'metal' ? 2.4 : 1.2
        let nx = -hx * k, ny = -hy * k, nz = 1; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl
        const dif = Math.max(0, nx * lx + ny * ly + nz * lz)
        let r: number, g: number, b: number
        if (c.pinta === 'solido') {
          const grao = 0.965 + 0.05 * ruido(x, y) + 0.015 * ruido(Math.floor(x / 3), Math.floor(y / 3))
          const s = (0.62 + 0.46 * dif) * grao
          r = c.cor[0] * s; g = c.cor[1] * s; b = c.cor[2] * s
        } else {
          const t = (x * ca + y * sa) / diag
          let base: [number, number, number]
          if (c.metal === 'holografico') { const hh = (t * 2.2 + 0.15 * nx + 0.1 * ruido(x >> 2, y >> 2)) % 1; base = hsl(hh, 0.55, 0.8) }
          else base = paleta(PALETAS[c.metal || 'ouro'], t * 1.6 + 0.08 * Math.sin(y * 0.02) + (nx + ny) * 0.12)
          const escov = 0.92 + 0.12 * ruido(Math.floor(x * ca + y * sa), Math.floor((y * ca - x * sa) / 6))
          const hx2 = lx + 0, hy2 = ly + 0, hz2 = lz + 1, hl = Math.hypot(hx2, hy2, hz2)
          // brilho especular TINGIDO pela cor do metal (metal não reflete branco puro) e sem estourar
          const esp = Math.pow(Math.max(0, (nx * hx2 + ny * hy2 + nz * hz2) / hl), 40)
          const s = (0.5 + 0.62 * dif) * escov
          const bril = (v: number) => v * s + (v * 0.55 + 255 * 0.22) * esp
          r = Math.min(252, bril(base[0])); g = Math.min(250, bril(base[1])); b = Math.min(245, bril(base[2]))
          if (c.metal === 'holografico') { const brilho = ruido(x, y) > 0.995 ? 60 : 0; r += brilho; g += brilho; b += brilho }
        }
        const o = i * 4
        rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = a[i]
      }
    }
    camadas.push({ alfa: a, rgba, contornos: contornos(bin, W, H, eps, minArea) })
  }
  return { camadas }
}
