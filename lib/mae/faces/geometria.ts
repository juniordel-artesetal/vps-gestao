// mae-faces — GEOMETRIA pura (mm ou px, tanto faz): área, ponto no polígono, distância, Douglas-Peucker,
// dividir polígono por uma reta. Sem DOM, testável no Node.
export type Pt = [number, number]

/** Área com sinal (fórmula do laço). Com y para baixo, positiva = sentido horário na tela. */
export function areaComSinal(p: Pt[]): number {
  let s = 0
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += p[j][0] * p[i][1] - p[i][0] * p[j][1]
  return s / 2
}
export const area = (p: Pt[]) => Math.abs(areaComSinal(p))

export function centroide(p: Pt[]): Pt {
  let a = 0, cx = 0, cy = 0
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const f = p[j][0] * p[i][1] - p[i][0] * p[j][1]
    a += f; cx += (p[j][0] + p[i][0]) * f; cy += (p[j][1] + p[i][1]) * f
  }
  if (Math.abs(a) < 1e-12) {
    const n = p.length || 1
    return [p.reduce((s, q) => s + q[0], 0) / n, p.reduce((s, q) => s + q[1], 0) / n]
  }
  return [cx / (3 * a), cy / (3 * a)]
}

export function caixa(p: Pt[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [x, y] of p) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }
}

/** Ponto dentro do polígono (par-ímpar). */
export function dentro(pt: Pt, p: Pt[]): boolean {
  let c = false
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j]
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

export function distSeg(pt: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const l2 = dx * dx + dy * dy
  let t = l2 ? ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / l2 : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(pt[0] - (a[0] + t * dx), pt[1] - (a[1] + t * dy))
}

/** Distância do ponto à borda do polígono. */
export function distBorda(pt: Pt, p: Pt[]): number {
  let d = Infinity
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) d = Math.min(d, distSeg(pt, p[j], p[i]))
  return d
}

/** Douglas-Peucker numa POLILINHA ABERTA (mantém o primeiro e o último ponto). */
export function simplificarAberta(pts: Pt[], tol: number): Pt[] {
  if (pts.length <= 2) return pts.slice()
  const manter = new Uint8Array(pts.length)
  manter[0] = 1; manter[pts.length - 1] = 1
  const pilha: [number, number][] = [[0, pts.length - 1]]
  while (pilha.length) {
    const [i, j] = pilha.pop()!
    let dmax = -1, k = -1
    for (let m = i + 1; m < j; m++) { const d = distSeg(pts[m], pts[i], pts[j]); if (d > dmax) { dmax = d; k = m } }
    if (dmax > tol && k > 0) { manter[k] = 1; pilha.push([i, k], [k, j]) }
  }
  return pts.filter((_, i) => manter[i])
}

/** Douglas-Peucker num polígono FECHADO (ancora nos 2 pontos mais distantes entre si). */
export function simplificarFechada(pts: Pt[], tol: number): Pt[] {
  if (pts.length <= 3) return pts.slice()
  let a = 0, b = 0, dm = -1
  for (let i = 0; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1])
    if (d > dm) { dm = d; b = i }
  }
  dm = -1
  for (let i = 0; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[b][0], pts[i][1] - pts[b][1])
    if (d > dm) { dm = d; a = i }
  }
  const [i0, i1] = a < b ? [a, b] : [b, a]
  const ida = simplificarAberta(pts.slice(i0, i1 + 1), tol)
  const volta = simplificarAberta([...pts.slice(i1), ...pts.slice(0, i0 + 1)], tol)
  return [...ida.slice(0, -1), ...volta.slice(0, -1)]
}

/** Interseção da reta infinita (p, q) com o segmento (a, b): parâmetro t na reta e u no segmento. */
function intersecao(p: Pt, q: Pt, a: Pt, b: Pt): { t: number; u: number } | null {
  const rx = q[0] - p[0], ry = q[1] - p[1], sx = b[0] - a[0], sy = b[1] - a[1]
  const den = rx * sy - ry * sx
  if (Math.abs(den) < 1e-12) return null
  const t = ((a[0] - p[0]) * sy - (a[1] - p[1]) * sx) / den
  const u = ((a[0] - p[0]) * ry - (a[1] - p[1]) * rx) / den
  return { t, u }
}

/**
 * Divide um polígono pela reta que passa por p e q. Usa o par de cruzamentos que envolve o meio do
 * segmento p–q (o lugar onde a usuária clicou). Devolve os dois polígonos e, em cada um, o índice do
 * vértice que inicia a aresta nova (o corte A→B), ou null se a reta não atravessa o polígono ali.
 */
export function dividirPoligono(poly: Pt[], p: Pt, q: Pt): { a: Pt[]; b: Pt[]; arestaNovaA: number; arestaNovaB: number; origemA: number[]; origemB: number[] } | null {
  const cruz: { t: number; i: number; pt: Pt }[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    const r = intersecao(p, q, a, b)
    if (r && r.u >= 0 && r.u < 1) cruz.push({ t: r.t, i, pt: [a[0] + (b[0] - a[0]) * r.u, a[1] + (b[1] - a[1]) * r.u] })
  }
  cruz.sort((x, y) => x.t - y.t)
  // o par consecutivo que contém o meio de p–q e cujo trecho fica DENTRO do polígono
  let par: [typeof cruz[0], typeof cruz[0]] | null = null
  for (let k = 0; k + 1 < cruz.length; k++) {
    const m = (cruz[k].t + cruz[k + 1].t) / 2
    const meio: Pt = [p[0] + (q[0] - p[0]) * m, p[1] + (q[1] - p[1]) * m]
    if (!dentro(meio, poly)) continue
    if (!par || Math.abs(m - 0.5) < Math.abs((par[0].t + par[1].t) / 2 - 0.5)) par = [cruz[k], cruz[k + 1]]
  }
  if (!par) return null
  const [c1, c2] = par[0].i <= par[1].i ? par : [par[1], par[0]]
  const n = poly.length
  // A: c1.pt → vértices (c1.i+1 … c2.i) → c2.pt ; fecha com c2.pt → c1.pt (aresta nova)
  const a: Pt[] = [c1.pt], origemA: number[] = [c1.i]
  for (let k = c1.i + 1; k <= c2.i; k++) { a.push(poly[k]); origemA.push(k) }
  a.push(c2.pt); origemA.push(-1)
  // B: c2.pt → vértices (c2.i+1 … c1.i, dando a volta) → c1.pt ; fecha com c1.pt → c2.pt (aresta nova)
  const b: Pt[] = [c2.pt], origemB: number[] = [c2.i]
  for (let k = (c2.i + 1) % n, guarda = 0; guarda < n; k = (k + 1) % n, guarda++) {
    b.push(poly[k]); origemB.push(k)
    if (k === c1.i) break
  }
  b.push(c1.pt); origemB.push(-1)
  if (a.length < 3 || b.length < 3) return null
  return { a, b, arestaNovaA: a.length - 1, arestaNovaB: b.length - 1, origemA, origemB }
}
