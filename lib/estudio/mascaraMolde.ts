// SOA Edition — MOLDE da artesã → MÁSCARA. Lê as linhas do molde (PDF, PNG, SVG, DXF) e devolve o contorno de cada
// peça como polígono: a arte solta dentro recorta na forma REAL do molde dela.
//
// Um caminho só para todos os formatos: o molde é rasterizado (pdf.js / imagem / DXF→SVG) numa resolução de análise,
// as linhas (traço escuro ou colorido, ou a silhueta opaca de um PNG) viram "tinta", pequenas falhas do traço são
// fechadas, o EXTERIOR é inundado a partir das bordas e cada região interna que sobra é uma PEÇA — seu contorno externo
// (Moore) simplificado (Douglas-Peucker) é a máscara. Vincos/dobras internos não dividem a peça (a máscara é a peça
// inteira); furos/janelas internos não são subtraídos.
import { carregarMolde } from './cliente'
import { decodificarDxf, dxfParaSvg, ehDxf } from './formatosCorte'

export interface RegiaoMolde {
  nome: string
  /** caixa da peça em fração do molde (0…1) */
  x: number; y: number; w: number; h: number
  /** contorno em fração do molde (0…1), fechado */
  pontos: [number, number][]
}
export interface MascaraImportada { nome: string; largura: number; altura: number; regioes: RegiaoMolde[] }

const LADO_ANALISE = 1400

/** Rasteriza o molde (qualquer formato aceito) num canvas de análise. */
async function rasterizar(f: File): Promise<{ cv: HTMLCanvasElement; largura: number; altura: number }> {
  let arq = f
  const cab = new TextDecoder('latin1').decode(new Uint8Array(await f.slice(0, 2048).arrayBuffer()))
  if (ehDxf(f.name, cab)) {
    const { svg } = await dxfParaSvg(decodificarDxf(await f.arrayBuffer()))
    arq = new File([svg], f.name.replace(/\.\w+$/, '') + '.svg', { type: 'image/svg+xml' })
  }
  const m = await carregarMolde(arq)
  const k = Math.min(1, LADO_ANALISE / Math.max(m.largura, m.altura)) || 1
  // SVG/PDF pequenos: amplia para a análise ter detalhe
  const k2 = Math.max(k, Math.min(4, 900 / Math.max(m.largura, m.altura)))
  const cv = document.createElement('canvas')
  cv.width = Math.max(1, Math.round(m.largura * k2)); cv.height = Math.max(1, Math.round(m.altura * k2))
  cv.getContext('2d')!.drawImage(m.fonte as CanvasImageSource, 0, 0, cv.width, cv.height)
  return { cv, largura: m.largura, altura: m.altura }
}

/** Contorno externo (Moore-neighbor) de um componente, começando no pixel mais acima-à-esquerda. */
function contorno(dentro: (x: number, y: number) => boolean, sx: number, sy: number, limite: number): [number, number][] {
  const DX = [-1, -1, 0, 1, 1, 1, 0, -1], DY = [0, -1, -1, -1, 0, 1, 1, 1]   // O, NO, N, NE, L, SE, S, SO (horário)
  const dir = (dx: number, dy: number) => { for (let i = 0; i < 8; i++) if (DX[i] === dx && DY[i] === dy) return i; return 0 }
  const pts: [number, number][] = [[sx, sy]]
  let cx = sx, cy = sy, bx = sx - 1, by = sy
  for (let passo = 0; passo < limite; passo++) {
    const d = dir(Math.sign(bx - cx), Math.sign(by - cy))
    let achou = false
    for (let k = 1; k <= 8; k++) {
      const nd = (d + k) % 8, nx = cx + DX[nd], ny = cy + DY[nd]
      if (dentro(nx, ny)) { const pd = (d + k + 7) % 8; bx = cx + DX[pd]; by = cy + DY[pd]; cx = nx; cy = ny; achou = true; break }
    }
    if (!achou || (cx === sx && cy === sy)) break
    pts.push([cx, cy])
  }
  return pts
}

/** Douglas-Peucker (polígono aberto; o fechamento é implícito). */
function simplificar(p: [number, number][], eps: number): [number, number][] {
  if (p.length < 4) return p
  const manter = new Uint8Array(p.length); manter[0] = manter[p.length - 1] = 1
  const pilha: [number, number][] = [[0, p.length - 1]]
  while (pilha.length) {
    const [a, b] = pilha.pop()!
    const [ax, ay] = p[a], [bx, by] = p[b], L = Math.hypot(bx - ax, by - ay) || 1
    let dm = -1, im = -1
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((by - ay) * p[i][0] - (bx - ax) * p[i][1] + bx * ay - by * ax) / L
      if (d > dm) { dm = d; im = i }
    }
    if (dm > eps && im > 0) { manter[im] = 1; pilha.push([a, im], [im, b]) }
  }
  return p.filter((_, i) => manter[i])
}

/** Lê o molde e devolve uma máscara por peça. */
export async function mascarasDoMolde(f: File): Promise<MascaraImportada> {
  const { cv, largura, altura } = await rasterizar(f)
  const W = cv.width, H = cv.height, N = W * H
  const d = cv.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H).data
  // 1) tinta = traço (escuro ou colorido) ou área opaca; transparente conta como papel branco
  let transparentes = 0
  const tinta = new Uint8Array(N)
  for (let i = 0; i < N; i++) {
    const a = d[i * 4 + 3] / 255
    if (a < 0.1) { transparentes++; continue }
    const r = d[i * 4] * a + 255 * (1 - a), g = d[i * 4 + 1] * a + 255 * (1 - a), b = d[i * 4 + 2] * a + 255 * (1 - a)
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    if (lum < 215 || (mx - mn) / (mx || 1) > 0.3) tinta[i] = 1
  }
  // PNG com fundo transparente e peça opaca clara (ex.: silhueta branca): a própria opacidade é a peça
  if (transparentes > N * 0.05) for (let i = 0; i < N; i++) if (d[i * 4 + 3] >= 128) tinta[i] = 1
  // 2) fecha falhas do traço (linha pontilhada/tracejada de corte): dilatação 2 px
  const R = Math.max(1, Math.round(Math.max(W, H) / 700))
  const dil = new Uint8Array(N)
  for (let y = 0; y < H; y++) { let ult = -1e9; for (let x = 0; x < W; x++) { if (tinta[y * W + x]) ult = x; if (x - ult <= R) dil[y * W + x] = 1 } ult = 1e9; for (let x = W - 1; x >= 0; x--) { if (tinta[y * W + x]) ult = x; if (ult - x <= R) dil[y * W + x] = 1 } }
  const dil2 = new Uint8Array(N)
  for (let x = 0; x < W; x++) { let ult = -1e9; for (let y = 0; y < H; y++) { if (dil[y * W + x]) ult = y; if (y - ult <= R) dil2[y * W + x] = 1 } ult = 1e9; for (let y = H - 1; y >= 0; y--) { if (dil[y * W + x]) ult = y; if (ult - y <= R) dil2[y * W + x] = 1 } }
  // 3) inunda o EXTERIOR a partir das bordas
  const ext = new Uint8Array(N), fila = new Int32Array(N)
  let ini = 0, fim = 0
  const semear = (i: number) => { if (!dil2[i] && !ext[i]) { ext[i] = 1; fila[fim++] = i } }
  for (let x = 0; x < W; x++) { semear(x); semear((H - 1) * W + x) }
  for (let y = 0; y < H; y++) { semear(y * W); semear(y * W + W - 1) }
  while (ini < fim) {
    const i = fila[ini++], x = i % W
    if (x > 0) semear(i - 1); if (x < W - 1) semear(i + 1); if (i >= W) semear(i - W); if (i < N - W) semear(i + W)
  }
  // 4) cada região interna (peça) = componente conexo do que não é exterior
  const rot = new Int32Array(N)
  const regioes: RegiaoMolde[] = []
  let nr = 0
  const minArea = N * 0.002
  for (let s = 0; s < N; s++) {
    if (ext[s] || rot[s]) continue
    nr++
    let x0 = W, y0 = H, x1 = 0, y1 = 0, area = 0
    ini = 0; fim = 0; rot[s] = nr; fila[fim++] = s
    while (ini < fim) {
      const i = fila[ini++], x = i % W, y = (i - x) / W
      area++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
      const viz = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]
      for (const v of viz) if (v >= 0 && !ext[v] && !rot[v]) { rot[v] = nr; fila[fim++] = v }
    }
    if (area < minArea) continue
    const id = nr
    const pts = contorno((x, y) => x >= 0 && y >= 0 && x < W && y < H && rot[y * W + x] === id, s % W, Math.floor(s / W), 8 * (W + H) * 4)
    const simp = simplificar(pts, Math.max(1.5, Math.max(W, H) / 900))
    if (simp.length < 3) continue
    regioes.push({
      nome: '', x: x0 / W, y: y0 / H, w: (x1 - x0 + 1) / W, h: (y1 - y0 + 1) / H,
      pontos: simp.map(([x, y]) => [Math.round((x / W) * 1e4) / 1e4, Math.round((y / H) * 1e4) / 1e4] as [number, number]),
    })
  }
  // página inteira "cheia" (foto/fundo chapado, sem linhas) não é molde
  const uteis = regioes.filter(r => !(r.w > 0.985 && r.h > 0.985))
  if (!uteis.length) throw new Error('Não achei nenhuma forma FECHADA neste molde. Confira se o contorno de corte está fechado (sem aberturas) — ou use um PNG com fundo transparente.')
  uteis.sort((a, b) => (Math.abs(a.y - b.y) > 0.05 ? a.y - b.y : a.x - b.x))
  uteis.forEach((r, i) => { r.nome = uteis.length > 1 ? `Peça ${i + 1}` : 'Molde' })
  return { nome: f.name.replace(/\.[^.]+$/, ''), largura, altura, regioes: uteis.slice(0, 40) }
}
