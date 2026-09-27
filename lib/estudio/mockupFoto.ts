// SOA Design — MOCKUP POR FOTO (o que o Tutu/Placeit faz): a assinante fotografa o produto DELA, marca (ou a IA propõe)
// a superfície, e cada arte nova sai "impressa" nessa foto — sem imprimir, montar nem cortar.
//
// O que faz parecer REAL (e não colado):
//   1. a arte vai na FOTO ORIGINAL (não depende de recortar o fundo), recortada só na área, com a borda suave;
//   2. geometria: plano por homografia (4 pontos) ou CILINDRO (caneca/copo/lata: a arte comprime nas laterais
//      como na vida real — o que uma malha comum não faz) ou malha livre (tecido);
//   3. a LUZ da foto passa pela arte: o sombreado largo multiplica (curvatura, dobras, sombra da mão), os brilhos
//      acima do "branco do produto" clareiam (reflexo da caneca), o grão fino da superfície entra por cima
//      (papel, kraft, tecido), o relevo desloca a arte um pouco (amassado) e a cor do material tinge a tinta.
// 🔒 A foto e a arte são da assinante; nada aqui é enviado a terceiros (a IA só propõe a área, no servidor).
import { distorcer, type Distorcao } from './transform'

export type Pt = { x: number; y: number }
/** Área da arte na foto, em fração (0…1) da foto. */
export type AreaFoto =
  | { tipo: 'plano'; pontos: Pt[] }                                   // TL, TR, BR, BL
  | { tipo: 'cilindro'; pontos: Pt[]; arco?: number }                 // TL, TC, TR, BL, BC, BR (faixa visível); arco = ° de cada lado do centro
  | { tipo: 'malha'; cols: number; rows: number; pontos: Pt[] }       // linha a linha (tecido/superfície livre)
  /** SMART AREA: polígono livre (começa com 4 pontos; dá para ADICIONAR pontos em qualquer lado). `cantos` = índices
   *  (TL, TR, BR, BL) dos 4 cantos; os pontos entre dois cantos curvam aquele lado. `curvo` = superfície cilíndrica. */
  | { tipo: 'poligono'; pontos: Pt[]; cantos: [number, number, number, number]; curvo?: boolean; arco?: number }

/** A arte DENTRO da área (modo "mexer na imagem"): deslocamento (fração da área), escala (1 = preenche) e giro (°). */
export interface TransformArte { dx: number; dy: number; escala: number; rot: number }
export const TRANSFORM_PADRAO: TransformArte = { dx: 0, dy: 0, escala: 1, rot: 0 }
/** Área nomeada do mockup (frente, lateral, alça…). `arte` = índice da arte própria (null = a arte principal). */
export interface SmartArea {
  id: string; nome: string
  area: Extract<AreaFoto, { tipo: 'poligono' }>
  transform: TransformArte
  arte?: number | null
  oculta?: boolean
}

export interface Realismo {
  /** 0…100 — sombreado da foto que escurece a arte (curvatura, dobras). */
  sombra: number
  /** 0…100 — brilhos da foto que clareiam a arte (reflexo). */
  brilho: number
  /** 0…100 — grão/textura fina da superfície por cima da arte (papel, tecido). */
  textura: number
  /** 0…100 — deslocamento da arte pelo relevo da superfície (amassado, costura). */
  relevo: number
  /** 0…100 — a cor do material tinge a tinta (kraft, tecido colorido). 0 = produto branco. */
  material: number
  /** 0…100 */
  opacidade: number
  /** px — suaviza a borda da arte (evita o corte "de tesoura"). */
  borda: number
  /** Como a arte ocupa a área: cobrir (preenche, corta a sobra), conter (inteira), esticar. */
  ajuste?: 'cobrir' | 'conter' | 'esticar'
}
export const REALISMO_PADRAO: Realismo = { sombra: 90, brilho: 70, textura: 55, relevo: 25, material: 0, opacidade: 100, borda: 1.2, ajuste: 'cobrir' }

export interface ConfigFoto extends Realismo {
  area: AreaFoto
  /** Contorno do produto (da IA), fração da foto — a arte nunca passa dele; também recorta para trocar o fundo. */
  mascaraProduto?: [number, number][] | null
  /** Ajuste da arte dentro da área (mover/escala/giro). */
  transform?: TransformArte | null
  /** Vãos dentro do contorno (dentro da alça) — ficam de fora no recorte do produto. */
  furosProduto?: [number, number][][] | null
}

const canvasDe = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c }
const dimDe = (s: CanvasImageSource) => ('naturalWidth' in s ? { w: (s as HTMLImageElement).naturalWidth, h: (s as HTMLImageElement).naturalHeight } : { w: (s as HTMLCanvasElement).width, h: (s as HTMLCanvasElement).height })

/** Ponto na parábola que passa por (0,a), (0.5,b), (1,c) — topo/base curvos do cilindro. */
const curva = (a: number, b: number, c: number, t: number) => a * (1 - t) * (1 - 2 * t) + 4 * b * t * (1 - t) + c * t * (2 * t - 1)

/** Cadeia de pontos de um canto ao outro (seguindo a ordem do polígono). */
function cadeia(p: Pt[], de: number, ate: number): Pt[] {
  const out: Pt[] = [], n = p.length
  for (let i = de; ; i = (i + 1) % n) { out.push(p[i]); if (i === ate || out.length > n) break }
  return out
}
/** Ponto na polilinha pelo comprimento (t 0…1). */
function naPolilinha(l: Pt[], t: number): Pt {
  if (l.length === 1) return l[0]
  const seg: number[] = []; let tot = 0
  for (let i = 1; i < l.length; i++) { const d = Math.hypot(l[i].x - l[i - 1].x, l[i].y - l[i - 1].y); seg.push(d); tot += d }
  let alvo = Math.max(0, Math.min(1, t)) * tot
  for (let i = 0; i < seg.length; i++) {
    if (alvo <= seg[i] || i === seg.length - 1) { const f = seg[i] ? Math.min(1, alvo / seg[i]) : 0; return { x: l[i].x + (l[i + 1].x - l[i].x) * f, y: l[i].y + (l[i + 1].y - l[i].y) * f } }
    alvo -= seg[i]
  }
  return l[l.length - 1]
}
/** Lado com 3+ pontos vira CURVA suave passando por eles (Catmull-Rom) — sem "bico" no ponto do meio. */
function suavizarCadeia(l: Pt[], porSeg = 12): Pt[] {
  if (l.length < 3) return l
  const P = (i: number) => l[Math.max(0, Math.min(l.length - 1, i))], out: Pt[] = []
  for (let i = 0; i < l.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2)
    for (let k = 0; k < porSeg; k++) {
      const t = k / porSeg, t2 = t * t, t3 = t2 * t
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) })
    }
  }
  out.push(l[l.length - 1])
  return out
}
const comprimento = (l: Pt[]) => l.slice(1).reduce((s, q, i) => s + Math.hypot(q.x - l[i].x, q.y - l[i].y), 0)
/** Os 4 lados do polígono: topo (TL→TR), direita (TR→BR), base (BL→BR), esquerda (TL→BL). */
export function ladosDoPoligono(a: Extract<AreaFoto, { tipo: 'poligono' }>, W = 1, H = 1) {
  const p = a.pontos.map(q => ({ x: q.x * W, y: q.y * H })), [tl, tr, br, bl] = a.cantos
  const lado = (l: Pt[]) => suavizarCadeia(l)
  return { topo: lado(cadeia(p, tl, tr)), dir: lado(cadeia(p, tr, br)), base: lado(cadeia(p, br, bl).reverse()), esq: lado(cadeia(p, bl, tl).reverse()) }
}

/** Área → distorção em pixels da foto (a mesma engine WebGL da camada). */
export function distorcaoDaArea(area: AreaFoto, W: number, H: number): Distorcao {
  const px = (p: Pt) => ({ x: p.x * W, y: p.y * H })
  if (area.tipo === 'plano') { const [tl, tr, br, bl] = area.pontos.map(px); return { tipo: 'perspectiva', cols: 2, rows: 2, pontos: [tl, tr, bl, br] } }
  if (area.tipo === 'malha') return { tipo: 'malha', cols: area.cols, rows: area.rows, pontos: area.pontos.map(px) }
  if (area.tipo === 'poligono') {
    const L = ladosDoPoligono(area, W, H)
    // só os 4 cantos (lados retos) e plano → perspectiva de verdade (homografia)
    if (!area.curvo && [L.topo, L.dir, L.base, L.esq].every(l => l.length === 2)) return { tipo: 'perspectiva', cols: 2, rows: 2, pontos: [L.topo[0], L.topo[1], L.base[0], L.base[1]] }
    // COONS: cada ponto da arte (u,v) vai para a mistura dos 4 lados — segue os pontos que a artesã colocou
    const a = (Math.max(20, Math.min(88, area.arco ?? 70)) * Math.PI) / 180
    const N = 28, M = 18, pts: Pt[] = []
    const P00 = L.topo[0], P10 = L.topo[L.topo.length - 1], P01 = L.base[0], P11 = L.base[L.base.length - 1]
    for (let r = 0; r <= M; r++) for (let c = 0; c <= N; c++) {
      const u0 = c / N, v = r / M
      const u = area.curvo ? (Math.sin((2 * u0 - 1) * a) / Math.sin(a) + 1) / 2 : u0
      const T = naPolilinha(L.topo, u), B = naPolilinha(L.base, u), E = naPolilinha(L.esq, v), D = naPolilinha(L.dir, v)
      const x = (1 - v) * T.x + v * B.x + (1 - u) * E.x + u * D.x - ((1 - u) * (1 - v) * P00.x + u * (1 - v) * P10.x + (1 - u) * v * P01.x + u * v * P11.x)
      const y = (1 - v) * T.y + v * B.y + (1 - u) * E.y + u * D.y - ((1 - u) * (1 - v) * P00.y + u * (1 - v) * P10.y + (1 - u) * v * P01.y + u * v * P11.y)
      pts.push({ x, y })
    }
    return { tipo: 'malha', cols: N + 1, rows: M + 1, pontos: pts }
  }
  // CILINDRO: a coluna j da arte (u = j/N) está no ângulo φ = (2u−1)·α da superfície; na foto ela aparece em
  // t = (sen φ / sen α + 1)/2 da largura — perto das laterais a arte comprime (a curva "foge" da câmera).
  const [tl, tc, tr, bl, bc, br] = area.pontos.map(px)
  const a = (Math.max(20, Math.min(88, area.arco ?? 70)) * Math.PI) / 180
  const N = 32, top: Pt[] = [], meio: Pt[] = [], base: Pt[] = []
  for (let j = 0; j <= N; j++) {
    const u = j / N, t = (Math.sin((2 * u - 1) * a) / Math.sin(a) + 1) / 2
    const pT = { x: curva(tl.x, tc.x, tr.x, t), y: curva(tl.y, tc.y, tr.y, t) }
    const pB = { x: curva(bl.x, bc.x, br.x, t), y: curva(bl.y, bc.y, br.y, t) }
    top.push(pT); base.push(pB); meio.push({ x: (pT.x + pB.x) / 2, y: (pT.y + pB.y) / 2 })
  }
  return { tipo: 'malha', cols: N + 1, rows: 3, pontos: [...top, ...meio, ...base] }
}

/** Contorno da área (px da foto) — para recortar a arte e desenhar o editor. */
export function contornoDaArea(area: AreaFoto, W: number, H: number): Pt[] {
  if (area.tipo === 'plano') return area.pontos.map(p => ({ x: p.x * W, y: p.y * H }))
  if (area.tipo === 'poligono') { const L = ladosDoPoligono(area, W, H); return [...L.topo, ...L.dir.slice(1), ...[...L.base].reverse().slice(1), ...[...L.esq].reverse().slice(1, -1)] }
  const d = distorcaoDaArea(area, W, H), c = d.cols, r = d.rows
  const P = (i: number, j: number) => d.pontos[j * c + i]
  const out: Pt[] = []
  for (let i = 0; i < c; i++) out.push(P(i, 0))
  for (let j = 1; j < r; j++) out.push(P(c - 1, j))
  for (let i = c - 2; i >= 0; i--) out.push(P(i, r - 1))
  for (let j = r - 2; j > 0; j--) out.push(P(0, j))
  return out
}

/**
 * Proporção REAL da superfície (largura/altura), para a arte não sair esticada: plano = média dos lados; cilindro =
 * a faixa DESENROLADA (a corda vista na foto × α/sen α — a parte que "foge" para as laterais também é superfície).
 */
export function proporcaoDaArea(area: AreaFoto, W: number, H: number): number {
  const d = (a: Pt, b: Pt) => Math.hypot((a.x - b.x) * W, (a.y - b.y) * H)
  if (area.tipo === 'plano') { const [tl, tr, br, bl] = area.pontos; return ((d(tl, tr) + d(bl, br)) / 2) / Math.max(1, (d(tl, bl) + d(tr, br)) / 2) }
  if (area.tipo === 'poligono') {
    const L = ladosDoPoligono(area, W, H), a = (Math.max(20, Math.min(88, area.arco ?? 70)) * Math.PI) / 180
    const larg = (comprimento(L.topo) + comprimento(L.base)) / 2 * (area.curvo ? a / Math.sin(a) : 1)
    return larg / Math.max(1, (comprimento(L.esq) + comprimento(L.dir)) / 2)
  }
  if (area.tipo === 'cilindro') {
    const [tl, , tr, bl, bc, br] = area.pontos, a = (Math.max(20, Math.min(88, area.arco ?? 70)) * Math.PI) / 180
    const corda = (d(tl, tr) + d(bl, br)) / 2, alt = (d(tl, bl) + d(area.pontos[1], bc) + d(tr, br)) / 3
    return (corda * (a / Math.sin(a))) / Math.max(1, alt)
  }
  const c = area.cols, r = area.rows, P = (i: number, j: number) => area.pontos[j * c + i]
  return ((d(P(0, 0), P(c - 1, 0)) + d(P(0, r - 1), P(c - 1, r - 1))) / 2) / Math.max(1, (d(P(0, 0), P(0, r - 1)) + d(P(c - 1, 0), P(c - 1, r - 1))) / 2)
}
/** A arte no formato da superfície: cobrir (corta o excesso, centralizado) ou conter (sobra transparente). */
export function arteNoFormato(arte: CanvasImageSource, proporcao: number, ajuste: Realismo['ajuste'] = 'cobrir'): CanvasImageSource {
  if (ajuste === 'esticar' || !(proporcao > 0)) return arte
  const { w, h } = dimDe(arte), pa = w / h
  if (Math.abs(pa - proporcao) / proporcao < 0.01) return arte
  if (ajuste === 'cobrir') {
    const sw = pa > proporcao ? h * proporcao : w, sh = pa > proporcao ? h : w / proporcao
    const c = canvasDe(sw, sh); c.getContext('2d')!.drawImage(arte, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, c.width, c.height); return c
  }
  const cw = pa > proporcao ? w : h * proporcao, ch = pa > proporcao ? w / proporcao : h
  const c = canvasDe(cw, ch); c.getContext('2d')!.drawImage(arte, (c.width - w) / 2, (c.height - h) / 2); return c
}

/** A arte no formato da área COM o ajuste da artesã (mover/escala/giro) — o que sobra da área fica transparente. */
export function arteNaArea(arte: CanvasImageSource, proporcao: number, t: TransformArte, ajuste: Realismo['ajuste'] = 'cobrir'): HTMLCanvasElement {
  const { w, h } = dimDe(arte), lado = 2048
  const W = proporcao >= 1 ? lado : Math.round(lado * proporcao), H = proporcao >= 1 ? Math.round(lado / proporcao) : lado
  const c = canvasDe(W, H), g = c.getContext('2d')!
  const base = ajuste === 'conter' ? Math.min(W / w, H / h) : ajuste === 'esticar' ? 1 : Math.max(W / w, H / h)
  g.translate(W / 2 + t.dx * W, H / 2 + t.dy * H); g.rotate((t.rot * Math.PI) / 180)
  if (ajuste === 'esticar') g.scale((W / w) * t.escala, (H / h) * t.escala); else g.scale(base * t.escala, base * t.escala)
  g.imageSmoothingQuality = 'high'
  g.drawImage(arte, -w / 2, -h / 2)
  return c
}

/** Área padrão (sem IA): um quadro no centro para a assinante ajustar. */
export function areaPadrao(tipo: AreaFoto['tipo'] = 'plano'): AreaFoto {
  if (tipo === 'cilindro') return { tipo, arco: 70, pontos: [{ x: 0.32, y: 0.36 }, { x: 0.5, y: 0.39 }, { x: 0.68, y: 0.36 }, { x: 0.32, y: 0.74 }, { x: 0.5, y: 0.77 }, { x: 0.68, y: 0.74 }] }
  if (tipo === 'malha') { const pts: Pt[] = []; for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) pts.push({ x: 0.3 + i * 0.2, y: 0.3 + j * 0.2 }); return { tipo, cols: 3, rows: 3, pontos: pts } }
  return { tipo: 'plano', pontos: [{ x: 0.3, y: 0.3 }, { x: 0.7, y: 0.3 }, { x: 0.7, y: 0.7 }, { x: 0.3, y: 0.7 }] }
}
/** Sem IA: o quadro padrão (a assinante marca na mão — o mockup nunca depende da IA). */
export const proporAreaFoto = (_foto?: HTMLCanvasElement): AreaFoto => areaPadrao('plano')

// ── campos escalares ──────────────────────────────────────────────────────────────────────────────
function borrarCampo(a: Float32Array<ArrayBuffer>, W: number, H: number, r: number): Float32Array<ArrayBuffer> {
  if (r < 1) return a
  let src = a, dst = new Float32Array(W * H)
  for (let p = 0; p < 2; p++) {
    for (let y = 0; y < H; y++) { const o = y * W; let s = 0; for (let x = -r; x <= r; x++) s += src[o + Math.min(W - 1, Math.max(0, x))]; for (let x = 0; x < W; x++) { dst[o + x] = s / (2 * r + 1); s += src[o + Math.min(W - 1, x + r + 1)] - src[o + Math.max(0, x - r)] } }
    ;[src, dst] = [dst, src]
    for (let x = 0; x < W; x++) { let s = 0; for (let y = -r; y <= r; y++) s += src[Math.min(H - 1, Math.max(0, y)) * W + x]; for (let y = 0; y < H; y++) { dst[y * W + x] = s / (2 * r + 1); s += src[Math.min(H - 1, y + r + 1) * W + x] - src[Math.max(0, y - r) * W + x] } }
    ;[src, dst] = [dst, src]
  }
  return src
}

/**
 * A ARTE IMPRESSA NA FOTO. Devolve a foto (mesmo tamanho) com a arte aplicada na área, com a luz, o grão e a cor da
 * superfície passando por ela.
 */
export function aplicarArteNaFoto(foto: HTMLCanvasElement, arte: CanvasImageSource | null, cfg: ConfigFoto): HTMLCanvasElement {
  const W = foto.width, H = foto.height
  const out = canvasDe(W, H), go = out.getContext('2d')!
  go.drawImage(foto, 0, 0)
  if (!arte) return out
  // 1) geometria: a arte no formato real da superfície (sem esticar) e deformada para ela
  const prop = proporcaoDaArea(cfg.area, W, H)
  const arteF = cfg.transform ? arteNaArea(arte, prop, cfg.transform, cfg.ajuste ?? 'cobrir') : arteNoFormato(arte, prop, cfg.ajuste ?? 'cobrir')
  const da = dimDe(arteF)
  const r = distorcer(arteF, da.w, da.h, distorcaoDaArea(cfg.area, W, H))
  const cont = contornoDaArea(cfg.area, W, H)
  let x0 = W, y0 = H, x1 = 0, y1 = 0
  for (const p of cont) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y) }
  const m = Math.ceil(4 + cfg.relevo / 10)
  x0 = Math.max(0, Math.floor(x0) - m); y0 = Math.max(0, Math.floor(y0) - m); x1 = Math.min(W, Math.ceil(x1) + m); y1 = Math.min(H, Math.ceil(y1) + m)
  const bw = x1 - x0, bh = y1 - y0
  if (bw < 2 || bh < 2) return out
  // 2) camada da arte + máscara (área ∩ produto), com a borda suavizada
  const cam = canvasDe(bw, bh), gc = cam.getContext('2d', { willReadFrequently: true })!
  gc.drawImage(r.canvas, r.minX - x0, r.minY - y0, r.canvas.width / r.escala, r.canvas.height / r.escala)
  const msk = canvasDe(bw, bh), gm = msk.getContext('2d', { willReadFrequently: true })!
  if (cfg.borda > 0) gm.filter = `blur(${cfg.borda}px)`
  gm.fillStyle = '#000'
  gm.beginPath(); cont.forEach((p, i) => (i ? gm.lineTo(p.x - x0, p.y - y0) : gm.moveTo(p.x - x0, p.y - y0))); gm.closePath(); gm.fill()
  gm.filter = 'none'
  if (cfg.mascaraProduto?.length) {
    gm.globalCompositeOperation = 'destination-in'
    gm.beginPath(); cfg.mascaraProduto.forEach(([x, y], i) => (i ? gm.lineTo(x * W - x0, y * H - y0) : gm.moveTo(x * W - x0, y * H - y0))); gm.closePath(); gm.fill()
    gm.globalCompositeOperation = 'source-over'
  }
  // 3) a luz da foto: luminância larga (sombreado), fina (grão) e o gradiente (relevo)
  const fd = go.getImageData(x0, y0, bw, bh).data
  const ad = gc.getImageData(0, 0, bw, bh)
  const A = ad.data, M = gm.getImageData(0, 0, bw, bh).data
  const N = bw * bh
  const L = new Float32Array(N), R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N)
  for (let p = 0; p < N; p++) { const i = p * 4; R[p] = fd[i]; G[p] = fd[i + 1]; B[p] = fd[i + 2]; L[p] = 0.299 * fd[i] + 0.587 * fd[i + 1] + 0.114 * fd[i + 2] }
  const diag = Math.hypot(bw, bh)
  const Llarga = borrarCampo(L, bw, bh, Math.max(2, Math.round(diag * 0.012)))
  const Lfina = borrarCampo(L, bw, bh, 2)
  // "branco do produto" = percentil alto do sombreado largo DENTRO da área
  const amostra: number[] = []
  for (let p = 0; p < N; p += 3) if (M[p * 4 + 3] > 200) amostra.push(Llarga[p])
  amostra.sort((a, b) => a - b)
  const ref = Math.max(30, amostra.length ? amostra[Math.floor(amostra.length * 0.9)] : 230)
  // cor média do material (tinge a tinta)
  const Rl = cfg.material > 0 ? borrarCampo(R, bw, bh, Math.max(2, Math.round(diag * 0.02))) : null
  const Gl = cfg.material > 0 ? borrarCampo(G, bw, bh, Math.max(2, Math.round(diag * 0.02))) : null
  const Bl = cfg.material > 0 ? borrarCampo(B, bw, bh, Math.max(2, Math.round(diag * 0.02))) : null
  const kS = cfg.sombra / 100, kB = cfg.brilho / 100, kT = (cfg.textura / 100) * 1.4, kR = (cfg.relevo / 100) * 0.12 * Math.max(1, diag / 900), kM = cfg.material / 100
  const op = Math.max(0, Math.min(1, cfg.opacidade / 100))
  const orig = cfg.relevo > 0 ? new Uint8ClampedArray(A) : A
  const res = new Uint8ClampedArray(N * 4)
  for (let y = 1; y < bh - 1; y++) for (let x = 1; x < bw - 1; x++) {
    const p = y * bw + x, i = p * 4
    const mk = M[i + 3]
    if (!mk) continue
    // relevo: a arte "escorrega" um pouco para o lado da sombra da dobra
    let si = i
    if (kR > 0) {
      const dx = (Lfina[p + 1] - Lfina[p - 1]) * kR, dy = (Lfina[p + bw] - Lfina[p - bw]) * kR
      const sx = Math.min(bw - 1, Math.max(0, Math.round(x - dx))), sy = Math.min(bh - 1, Math.max(0, Math.round(y - dy)))
      si = (sy * bw + sx) * 4
    }
    const aa = orig[si + 3]
    if (!aa) continue
    const s = Llarga[p] / ref
    const sombra = s < 1 ? 1 - kS * (1 - s) : 1                                   // multiplica (curvatura, dobra)
    const brilho = s > 1 ? Math.min(1, kB * (s - 1) / Math.max(0.04, 255 / ref - 1)) : 0   // tela (reflexo)
    const grao = kT * (L[p] - Lfina[p] + (Lfina[p] - Llarga[p]) * 0.35)          // grão fino + um pouco do médio
    for (let c = 0; c < 3; c++) {
      let v = orig[si + c]
      if (kM > 0) { const mat = (c === 0 ? Rl! : c === 1 ? Gl! : Bl!)[p] / Math.max(1, ref); v *= 1 - kM + kM * Math.min(1.2, mat) }
      v = v * sombra
      v = v + (255 - v) * brilho
      v += grao
      res[i + c] = v
    }
    res[i + 3] = Math.round(aa * (mk / 255) * op)
  }
  ad.data.set(res)
  gc.putImageData(ad, 0, 0)
  go.drawImage(cam, x0, y0)
  return out
}

/** Arredonda um polígono esparso (Chaikin): o contorno da IA vem com poucos pontos e a borda ficaria "facetada". */
export function arredondarPoligono(p: [number, number][], passadas = 2): [number, number][] {
  let pts = p
  for (let k = 0; k < passadas && pts.length >= 3; k++) {
    const n: [number, number][] = []
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length]
      n.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75])
    }
    pts = n
  }
  return pts
}

/** Recorta o PRODUTO da foto (contorno + vãos da IA) com a borda suavizada — para trocar o fundo/montar cena. */
export function recortarProduto(foto: HTMLCanvasElement, contorno: [number, number][], furos: [number, number][][] = [], suave = 1.5): HTMLCanvasElement {
  const W = foto.width, H = foto.height
  const m = canvasDe(W, H), gm = m.getContext('2d')!
  if (suave > 0) gm.filter = `blur(${suave * Math.max(1, Math.max(W, H) / 1200)}px)`
  gm.beginPath()
  for (const pol of [contorno, ...furos].map(q => arredondarPoligono(q))) { pol.forEach(([x, y], i) => (i ? gm.lineTo(x * W, y * H) : gm.moveTo(x * W, y * H))); gm.closePath() }
  gm.fillStyle = '#000'; gm.fill('evenodd')
  const c = canvasDe(W, H), g = c.getContext('2d')!
  g.drawImage(foto, 0, 0); g.globalCompositeOperation = 'destination-in'; g.drawImage(m, 0, 0)
  return c
}


// ── SMART AREAS ──────────────────────────────────────────────────────────────────────────────────
export const idArea = () => Math.random().toString(36).slice(2, 10)
/** Retângulo → área de 4 pontos. */
export function areaRetangulo(x0: number, y0: number, x1: number, y1: number): SmartArea['area'] {
  const [a, b] = [Math.min(x0, x1), Math.max(x0, x1)], [c, d] = [Math.min(y0, y1), Math.max(y0, y1)]
  return { tipo: 'poligono', pontos: [{ x: a, y: c }, { x: b, y: c }, { x: b, y: d }, { x: a, y: d }], cantos: [0, 1, 2, 3] }
}
/** Qualquer área antiga (plano/cilindro/malha) → polígono de Smart Area. */
export function paraPoligono(a: AreaFoto): SmartArea['area'] {
  if (a.tipo === 'poligono') return a
  if (a.tipo === 'plano') return { tipo: 'poligono', pontos: a.pontos.slice(0, 4), cantos: [0, 1, 2, 3] }
  if (a.tipo === 'cilindro') { const [tl, tc, tr, bl, bc, br] = a.pontos; return { tipo: 'poligono', pontos: [tl, tc, tr, br, bc, bl], cantos: [0, 2, 3, 5], curvo: true, arco: a.arco ?? 70 } }
  const c = a.cols, r = a.rows, P = (i: number, j: number) => a.pontos[j * c + i], pts: Pt[] = []
  for (let i = 0; i < c; i++) pts.push(P(i, 0))
  for (let j = 1; j < r; j++) pts.push(P(c - 1, j))
  for (let i = c - 2; i >= 0; i--) pts.push(P(i, r - 1))
  for (let j = r - 2; j > 0; j--) pts.push(P(0, j))
  return { tipo: 'poligono', pontos: pts, cantos: [0, c - 1, c - 1 + r - 1, 2 * (c - 1) + r - 1] }
}
/** Insere um ponto no lado mais próximo de `q` (mantém os cantos). Devolve a área nova e o índice do ponto. */
export function inserirPonto(a: SmartArea['area'], q: Pt): { area: SmartArea['area']; indice: number } {
  const p = a.pontos, n = p.length
  let melhor = 0, dm = Infinity
  for (let i = 0; i < n; i++) {
    const A = p[i], B = p[(i + 1) % n], vx = B.x - A.x, vy = B.y - A.y, L2 = vx * vx + vy * vy || 1
    const t = Math.max(0, Math.min(1, ((q.x - A.x) * vx + (q.y - A.y) * vy) / L2))
    const d = Math.hypot(A.x + vx * t - q.x, A.y + vy * t - q.y)
    if (d < dm) { dm = d; melhor = i }
  }
  const pontos = [...p.slice(0, melhor + 1), q, ...p.slice(melhor + 1)]
  const cantos = a.cantos.map(c => (c > melhor ? c + 1 : c)) as SmartArea['area']['cantos']
  return { area: { ...a, pontos, cantos }, indice: melhor + 1 }
}
/** Remove um ponto que NÃO é canto. */
export function removerPonto(a: SmartArea['area'], i: number): SmartArea['area'] {
  if (a.cantos.includes(i) || a.pontos.length <= 4) return a
  return { ...a, pontos: a.pontos.filter((_, k) => k !== i), cantos: a.cantos.map(c => (c > i ? c - 1 : c)) as SmartArea['area']['cantos'] }
}
/** Todas as Smart Areas na foto, cada uma com a sua arte (ou a principal) e o seu ajuste. */
export function aplicarAreas(foto: HTMLCanvasElement, artes: CanvasImageSource[], areas: SmartArea[], real: Realismo, extra: { mascaraProduto?: [number, number][] | null } = {}): HTMLCanvasElement {
  let out = foto
  for (const a of areas) {
    if (a.oculta) continue
    const arte = artes[a.arte ?? 0] ?? artes[0]
    if (!arte) continue
    out = aplicarArteNaFoto(out, arte, { ...real, area: a.area, transform: a.transform, mascaraProduto: extra.mascaraProduto })
  }
  return out === foto ? aplicarArteNaFoto(foto, null, { ...real, area: areaPadrao() }) : out
}

// ── MOLDURA DA ARTE (alças do modo "mexer na imagem") ─────────────────────────────────────────────────────────────
/** Ponto (u, v) da arte (0…1 = a área; fora disso, extrapola) → ponto na foto (fração). Mesmo mapa do warp. */
export function uvParaFoto(area: AreaFoto, u: number, v: number): Pt {
  const pol = area.tipo === 'poligono' ? area : paraPoligono(area)
  const L = ladosDoPoligono(pol)
  const P00 = L.topo[0], P10 = L.topo[L.topo.length - 1], P01 = L.base[0], P11 = L.base[L.base.length - 1]
  const cu = Math.max(0, Math.min(1, u)), cv = Math.max(0, Math.min(1, v))
  const a = (Math.max(20, Math.min(88, pol.arco ?? 70)) * Math.PI) / 180
  const uu = pol.curvo ? (Math.sin((2 * cu - 1) * a) / Math.sin(a) + 1) / 2 : cu
  const T = naPolilinha(L.topo, uu), B = naPolilinha(L.base, uu), E = naPolilinha(L.esq, cv), D = naPolilinha(L.dir, cv)
  const bil = (k: 'x' | 'y') => (1 - uu) * (1 - cv) * P00[k] + uu * (1 - cv) * P10[k] + (1 - uu) * cv * P01[k] + uu * cv * P11[k]
  const p = { x: (1 - cv) * T.x + cv * B.x + (1 - uu) * E.x + uu * D.x - bil('x'), y: (1 - cv) * T.y + cv * B.y + (1 - uu) * E.y + uu * D.y - bil('y') }
  // fora da área: segue a tendência dos cantos (a arte pode ser maior que a área — a área só recorta)
  const du = u - cu, dv = v - cv
  if (du || dv) {
    const eu = { x: (P10.x - P00.x) * (1 - cv) + (P11.x - P01.x) * cv, y: (P10.y - P00.y) * (1 - cv) + (P11.y - P01.y) * cv }
    const ev = { x: (P01.x - P00.x) * (1 - cu) + (P11.x - P10.x) * cu, y: (P01.y - P00.y) * (1 - cu) + (P11.y - P10.y) * cu }
    p.x += eu.x * du + ev.x * dv; p.y += eu.y * du + ev.y * dv
  }
  return p
}
/** Onde a arte (com o ajuste `t`) cai na foto: contorno da moldura, 4 cantos (alças de escala), centro e alça de giro. */
export function quadroDaArte(area: AreaFoto, W: number, H: number, arte: { w: number; h: number }, t: TransformArte, ajuste: Realismo['ajuste'] = 'cobrir') {
  const prop = proporcaoDaArea(area, W, H), lado = 2048
  const UW = prop >= 1 ? lado : Math.round(lado * prop), UH = prop >= 1 ? Math.round(lado / prop) : lado
  const base = ajuste === 'conter' ? Math.min(UW / arte.w, UH / arte.h) : Math.max(UW / arte.w, UH / arte.h)
  const hw = ajuste === 'esticar' ? (UW / 2) * t.escala : (arte.w * base * t.escala) / 2
  const hh = ajuste === 'esticar' ? (UH / 2) * t.escala : (arte.h * base * t.escala) / 2
  const cx = UW / 2 + t.dx * UW, cy = UH / 2 + t.dy * UH, r = (t.rot * Math.PI) / 180, co = Math.cos(r), si = Math.sin(r)
  const uv = (x: number, y: number) => uvParaFoto(area, (cx + x * co - y * si) / UW, (cy + x * si + y * co) / UH)
  const cantosL: [number, number][] = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]
  const contorno: Pt[] = []
  for (let k = 0; k < 4; k++) { const [ax, ay] = cantosL[k], [bx, by] = cantosL[(k + 1) % 4]; for (let s = 0; s < 12; s++) contorno.push(uv(ax + ((bx - ax) * s) / 12, ay + ((by - ay) * s) / 12)) }
  return { contorno, cantos: cantosL.map(([x, y]) => uv(x, y)), centro: uv(0, 0), giro: uv(0, -hh - Math.max(UW, UH) * 0.1), topo: uv(0, -hh) }
}

// ── COMPOSIÇÃO de um mockup de áreas (criar e usar usam a MESMA função) ───────────────────────────────────────────
export type FundoMockup = { tipo: 'original' } | { tipo: 'cor'; cor: string }
export interface MockupAreas { areas: SmartArea[]; real: Realismo; mascara?: [number, number][] | null; furos?: [number, number][][]; fundo?: FundoMockup }
/** Cada área visível recebe a sua arte (`arteDe`) com o seu ajuste (`transformDe`, senão o da área) + fundo. */
export function comporAreas(base: HTMLCanvasElement, m: MockupAreas, arteDe: (a: SmartArea) => CanvasImageSource | null, transformDe?: (a: SmartArea) => TransformArte | undefined): HTMLCanvasElement {
  let c = base
  for (const a of m.areas) {
    if (a.oculta) continue
    const arte = arteDe(a)
    if (!arte) continue
    c = aplicarArteNaFoto(c, arte, { ...m.real, area: a.area, transform: transformDe?.(a) || a.transform, mascaraProduto: m.mascara || null })
  }
  if (c === base) { c = canvasDe(base.width, base.height); c.getContext('2d')!.drawImage(base, 0, 0) }
  const mask = m.mascara
  if (!m.fundo || m.fundo.tipo === 'original' || !mask?.length) return c
  const prod = recortarProduto(c, mask, m.furos || []), out = canvasDe(c.width, c.height), g = out.getContext('2d')!
  g.fillStyle = m.fundo.cor; g.fillRect(0, 0, out.width, out.height)
  const ys = mask.map(p => p[1]), xs = mask.map(p => p[0])
  const base0 = Math.max(...ys) * out.height, cx = ((Math.min(...xs) + Math.max(...xs)) / 2) * out.width, rw = ((Math.max(...xs) - Math.min(...xs)) / 2) * out.width
  const gr = g.createRadialGradient(cx, base0, 0, cx, base0, rw * 1.1); gr.addColorStop(0, 'rgba(0,0,0,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)')
  g.save(); g.translate(cx, base0); g.scale(1, 0.16); g.translate(-cx, -base0); g.fillStyle = gr; g.beginPath(); g.arc(cx, base0, rw * 1.1, 0, Math.PI * 2); g.fill(); g.restore()
  g.drawImage(prod, 0, 0)
  return out
}
