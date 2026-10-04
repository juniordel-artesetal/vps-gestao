// mae-apliques — SILHUETA do aplique (Sprint 11), o "deslocamento externo" do Silhouette Studio:
//   contorno pelo canal ALFA → preencher os buracos → offset com Clipper2 (canto REDONDO) → suavizar.
// Também a BORDINHA (o mesmo offset, menor, na cor escolhida, por baixo do aplique impresso).
// Entrada: o alfa da imagem do aplique já no tamanho da arte (px) + px/mm. Saída: polígonos em mm, com
// origem no canto superior esquerdo da imagem. Puro e determinístico.
import { inflatePathsD, unionD, FillRule, JoinType, EndType, type PathsD } from 'clipper2-ts'
import { rotular, contorno } from '../faces/raster'
import { area, simplificarFechada, type Pt } from '../faces/geometria'

export interface OpcoesSilhueta {
  /** Alfa mínimo para contar como "tem desenho" (0–255). */
  limiar?: number
  /** Pedaços menores que isto (mm²) são ignorados (poeira, sombras soltas). */
  areaMinMm2?: number
  /** Raio da suavização (mm): fecha reentrâncias finas e arredonda o serrilhado dos pixels. */
  suavizarMm?: number
}

const D = (p: Pt[]) => p.map(([x, y]) => ({ x, y }))
const P = (ps: PathsD): Pt[][] => ps.map(p => p.map(q => [Math.round(q.x * 1000) / 1000, Math.round(q.y * 1000) / 1000] as Pt)).filter(p => p.length >= 3)

/** Contorno externo da imagem (mm), já com os buracos preenchidos. */
export function contornoDoAlfa(alfa: Uint8Array | Uint8ClampedArray, w: number, h: number, pxPorMm: number, o: OpcoesSilhueta = {}): Pt[][] {
  const lim = o.limiar ?? 128
  // 1) fundo: regiões transparentes; as que NÃO tocam a borda são buracos → viram desenho
  const fundo = new Uint8Array(w * h)
  for (let p = 0; p < w * h; p++) fundo[p] = alfa[p] >= lim ? 1 : 0          // 1 = "linha" (desenho) p/ o rotulador
  const rf = rotular({ w, h, d: fundo })
  const cheio = new Uint8Array(w * h)
  for (let p = 0; p < w * h; p++) cheio[p] = alfa[p] >= lim || (rf.rot[p] && !rf.tocaBorda[rf.rot[p]]) ? 0 : 1   // 0 = desenho
  // 2) cada pedaço de desenho → contorno externo pelas bordas dos pixels
  const rd = rotular({ w, h, d: cheio })
  const minPx = (o.areaMinMm2 ?? 2) * pxPorMm * pxPorMm
  const out: Pt[][] = []
  for (let r = 1; r <= rd.n; r++) {
    if (rd.area[r] < minPx) continue
    const c = contorno(rd.rot, w, h, r)
    if (!c) continue
    const mm = simplificarFechada(c.pts as Pt[], 0.6).map(([x, y]) => [x / pxPorMm, y / pxPorMm] as Pt)
    if (mm.length >= 3 && area(mm) > 0) out.push(mm)
  }
  return out
}

/** Offset com cantos redondos (mm) + união; 0 = só a união. */
export function deslocar(polis: Pt[][], mm: number): Pt[][] {
  if (!polis.length) return []
  const u = unionD(polis.map(D), FillRule.NonZero) as PathsD
  if (mm <= 0) return P(u)
  return P(inflatePathsD(u, mm, JoinType.Round, EndType.Polygon, 2, 3) as PathsD)
}

/** Suaviza: fecha (abre e fecha com cantos redondos) e tira os degraus de pixel. */
export function suavizar(polis: Pt[][], rMm: number): Pt[][] {
  if (!polis.length || rMm <= 0) return polis
  const a = inflatePathsD(polis.map(D), rMm, JoinType.Round, EndType.Polygon, 2, 3) as PathsD
  const b = inflatePathsD(a, -rMm, JoinType.Round, EndType.Polygon, 2, 3) as PathsD
  return P(b).map(p => simplificarFechada(p, 0.04))
}

/**
 * Silhueta pronta para o rastreio: contorno do alfa (buracos preenchidos) → deslocamento externo com
 * canto redondo → suavizar. Só os contornos de FORA (o que fica dentro some — é preenchido de preto).
 */
export function silhueta(alfa: Uint8Array | Uint8ClampedArray, w: number, h: number, pxPorMm: number, deslocamentoMm: number, o: OpcoesSilhueta = {}): Pt[][] {
  return silhuetaDoContorno(contornoDoAlfa(alfa, w, h, pxPorMm, o), deslocamentoMm, o.suavizarMm)
}

/** Silhueta a partir do contorno já extraído (deslocar + suavizar, só os anéis de fora). */
export function silhuetaDoContorno(base: Pt[][], deslocamentoMm: number, suavizarMm?: number): Pt[][] {
  const d = deslocar(base, deslocamentoMm)
  const s = suavizar(d, suavizarMm ?? Math.min(0.5, 0.15 + deslocamentoMm / 10))
  // tira os anéis internos que o offset possa ter deixado (a silhueta é cheia)
  return s.filter(p => areaComSinalPositivo(p))
}

function areaComSinalPositivo(p: Pt[]): boolean {
  let s = 0
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += p[j][0] * p[i][1] - p[i][0] * p[j][1]
  // Clipper devolve externos num sentido e furos no outro; o externo de maior área define o sentido "positivo"
  return s !== 0 && Math.sign(s) === SENTIDO_EXTERNO
}
/** Sentido dos contornos externos do Clipper2 (y para baixo): área com sinal positiva. */
const SENTIDO_EXTERNO = 1

/** Caminho SVG (mm) de vários anéis — o motor desenha com regra par-ímpar. */
export function caminhoDosAneis(polis: Pt[][], dx = 0, dy = 0): string {
  const f = (v: number) => Math.round(v * 1000) / 1000
  return polis.map(p => 'M' + p.map(([x, y]) => `${f(x + dx)} ${f(y + dy)}`).join('L') + 'Z').join('')
}

export function caixaDosAneis(polis: Pt[][]): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of polis) for (const [x, y] of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  return { x0, y0, x1, y1 }
}
