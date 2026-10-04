// mae-faces — DETECÇÃO DE FACES (pipeline único, raster, para todos os formatos — docs/mae-spec.md):
// 1) a máscara de linhas já vem binarizada a ~200 dpi; 2) fechar pontilhado; 3) rotular regiões,
// descartar o fundo (toca a borda) e as < 20 mm²; 4) expandir até o centro da linha; 5) contorno pelas
// bordas dos pixels + Douglas-Peucker (~0,1 mm) e mm; 6) cada trecho: com o fundo = CORTE, com outra
// face = DOBRA. Extra (não está na spec): região cercada por UMA face só = FURO (janela da alça).
import { binarizar, contorno, expandir, fechar, rotular, vizinhas, type Mascara } from './raster'
import { simplificarAberta, simplificarFechada, area, type Pt } from './geometria'

export type TipoAresta = 'cut' | 'fold'

export interface FaceDetectada {
  /** Polígono em mm, no sistema do molde (origem no canto superior esquerdo do recorte). */
  poligono: Pt[]
  /** Tipo de cada aresta i → i+1. */
  tipos: TipoAresta[]
  furo: boolean
  areaMm2: number
}

export interface OpcoesDeteccao {
  pxPorMm: number
  /** "Fechar pontilhado", em mm (raio do fechamento morfológico). */
  fecharMm?: number
  /** Regiões menores que isto (mm²) são descartadas (padrão 20). */
  areaMinimaMm2?: number
  /** Linhas tracejadas do arquivo (SVG/DXF/PDF), já na mesma grade: trecho junto delas = DOBRA. */
  dobras?: Mascara | null
  /** Tolerância da simplificação, em mm (padrão 0,1; nunca menos que 1 px). */
  toleranciaMm?: number
}

export interface ResultadoDeteccao { faces: FaceDetectada[]; ms: number; regioes: number; descartadas: number }

const r2 = (v: number) => Math.round(v * 100) / 100

export function detectarFaces(linhas: Mascara, o: OpcoesDeteccao): ResultadoDeteccao {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const { w, h } = linhas
  const k = o.pxPorMm
  const m = fechar(linhas, Math.round((o.fecharMm ?? 0) * k))
  const { rot, n, area: areaPx, tocaBorda } = rotular(m)

  // fundo = tudo o que toca a borda (vira um rótulo só: 1º que tocar)
  let FUNDO = 0
  const minPx = (o.areaMinimaMm2 ?? 20) * k * k
  const mantida = new Uint8Array(n + 1)
  let descartadas = 0
  for (let r = 1; r <= n; r++) {
    if (tocaBorda[r]) { if (!FUNDO) FUNDO = r; mantida[r] = 1 }
    else if (areaPx[r] >= minPx) mantida[r] = 1
    else descartadas++
  }
  if (FUNDO) for (let p = 0; p < w * h; p++) if (rot[p] && tocaBorda[rot[p]]) rot[p] = FUNDO
  const exp = expandir(rot, w, h, r => !!mantida[r])
  const viz = vizinhas(exp, w, h)

  // contornos de todas as regiões (o furo depende do contorno das vizinhas)
  const contornos = new Map<number, NonNullable<ReturnType<typeof contorno>>>()
  for (let r = 1; r <= n; r++) {
    if (!mantida[r] || r === FUNDO) continue
    const c = contorno(exp, w, h, r)
    if (c && c.pts.length >= 4) contornos.set(r, c)
  }
  // FURO: não encosta no fundo e é "abraçada" por uma face só (≥ 60% do contorno junto dela) —
  // janelas de alça, corações, fendas. A usuária pode trocar furo ↔ face.
  const furos = new Set<number>()
  for (const [r, c] of contornos) {
    const v = viz.get(r)
    if (!v || v.has(FUNDO) || v.has(0)) continue
    if (v.size === 1) { furos.add(r); continue }
    const conta = new Map<number, number>()
    for (const f of c.fora) conta.set(f, (conta.get(f) || 0) + 1)
    if (Math.max(...conta.values()) >= 0.6 * c.fora.length) { furos.add(r); continue }
    // fenda: região estreita (largura média 2·área/perímetro < 2,5 mm) no meio de faces
    if ((2 * areaPx[r]) / c.fora.length / k < 2.5) furos.add(r)
  }
  const furo = (r: number) => furos.has(r)
  const tolPx = Math.max(1, (o.toleranciaMm ?? 0.1) * k)
  const minTrechoPx = 1 * k   // trechos < 1 mm herdam o tipo do vizinho (ruído de canto)
  const dobras = o.dobras
  // dica de dobra: procura o tracejado só ATRAVESSANDO a borda (2 px para cada lado, na normal do passo)
  const pertoDeDobra = (a: [number, number], b: [number, number]) => {
    if (!dobras) return false
    const dx = b[0] - a[0], dy = b[1] - a[1]
    // pixel de fora (à esquerda do passo) e a normal que aponta para fora
    const fx = dx === 1 ? a[0] : dx === -1 ? a[0] - 1 : dy === 1 ? a[0] : a[0] - 1
    const fy = dx === 1 ? a[1] - 1 : dx === -1 ? a[1] : dy === 1 ? a[1] : a[1] - 1
    const nx = dy, ny = -dx
    for (let s = -3; s <= 2; s++) {
      const x = fx + nx * s, y = fy + ny * s
      if (x >= 0 && y >= 0 && x < w && y < h && dobras.d[y * w + x]) return true
    }
    return false
  }

  const faces: FaceDetectada[] = []
  for (let r = 1; r <= n; r++) {
    const c = contornos.get(r)
    if (!c) continue
    const ehFuro = furo(r)
    // tipo de cada passo unitário
    const tipo: TipoAresta[] = c.fora.map((f, i) => {
      if (ehFuro || f <= 0 || f === FUNDO || furo(f)) return !ehFuro && pertoDeDobra(c.pts[i], c.pts[(i + 1) % c.pts.length]) ? 'fold' : 'cut'
      return 'fold'
    })
    const { poligono, tipos } = simplificarComTipos(c.pts, tipo, tolPx, minTrechoPx)
    if (poligono.length < 3) continue
    const mm: Pt[] = poligono.map(([x, y]) => [r2(x / k), r2(y / k)])
    faces.push({ poligono: mm, tipos, furo: ehFuro, areaMm2: r2(area(mm)) })
  }
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now()
  return { faces, ms: Math.round(t1 - t0), regioes: n, descartadas }
}

/**
 * Junta os passos unitários em TRECHOS do mesmo tipo (trechos curtos herdam o vizinho), simplifica cada
 * trecho com Douglas-Peucker mantendo as pontas — assim a quebra corte/dobra vira sempre um vértice.
 */
export function simplificarComTipos(pts: Pt[], tipo: TipoAresta[], tol: number, minTrecho: number): { poligono: Pt[]; tipos: TipoAresta[] } {
  const N = pts.length
  const t = tipo.slice()
  // suaviza trechos curtos (até 3 passadas)
  for (let rodada = 0; rodada < 3; rodada++) {
    const trechos = trechosDe(t)
    if (trechos.length <= 1) break
    let mudou = false
    for (let i = 0; i < trechos.length; i++) {
      const tr = trechos[i]
      if (tr.len >= minTrecho) continue
      const ant = trechos[(i - 1 + trechos.length) % trechos.length], prox = trechos[(i + 1) % trechos.length]
      const novo = (ant.len >= prox.len ? ant : prox).tipo
      if (novo !== tr.tipo) { for (let k = 0; k < tr.len; k++) t[(tr.ini + k) % N] = novo; mudou = true }
    }
    if (!mudou) break
  }
  const trechos = trechosDe(t)
  if (trechos.length <= 1) {
    const p = simplificarFechada(suavizar(pts, true), tol)
    return { poligono: p, tipos: p.map(() => t[0]) }
  }
  const poligono: Pt[] = [], tipos: TipoAresta[] = []
  for (const tr of trechos) {
    const seg: Pt[] = []
    for (let k = 0; k <= tr.len; k++) seg.push(pts[(tr.ini + k) % N])
    const s = simplificarAberta(suavizar(seg, false), tol)
    for (let k = 0; k < s.length - 1; k++) { poligono.push(s[k]); tipos.push(tr.tipo) }
  }
  return { poligono, tipos }
}

/**
 * Tira o "serrilhado" dos pixels antes do Douglas-Peucker: 2 passadas de média [1 2 1]/4. Mexe no máximo
 * ~½ px; numa polilinha aberta as pontas (quebras corte/dobra) ficam paradas.
 */
function suavizar(pts: Pt[], fechada: boolean): Pt[] {
  let a = pts
  const n = a.length
  if (n < 5) return a
  for (let passada = 0; passada < 2; passada++) {
    const b: Pt[] = a.map(p => [p[0], p[1]])
    for (let i = 0; i < n; i++) {
      if (!fechada && (i === 0 || i === n - 1)) continue
      const p = a[(i - 1 + n) % n], q = a[(i + 1) % n]
      b[i] = [(p[0] + 2 * a[i][0] + q[0]) / 4, (p[1] + 2 * a[i][1] + q[1]) / 4]
    }
    a = b
  }
  return a
}

function trechosDe(t: TipoAresta[]): { ini: number; len: number; tipo: TipoAresta }[] {
  const N = t.length
  // começa num ponto de troca (se houver), para nenhum trecho ficar partido na volta
  let ini = 0
  for (let i = 0; i < N; i++) if (t[i] !== t[(i - 1 + N) % N]) { ini = i; break }
  const out: { ini: number; len: number; tipo: TipoAresta }[] = []
  for (let k = 0; k < N; k++) {
    const i = (ini + k) % N
    const ult = out[out.length - 1]
    if (ult && ult.tipo === t[i]) ult.len++
    else out.push({ ini: i, len: 1, tipo: t[i] })
  }
  if (out.length > 1 && out[0].tipo === out[out.length - 1].tipo) {
    const u = out.pop()!; out[0].ini = u.ini; out[0].len += u.len
  }
  return out
}

/** Atalho: RGBA (do canvas) → máscara de linhas. */
export function mascaraDeImagem(rgba: Uint8ClampedArray, w: number, h: number, limiar?: number): Mascara {
  return binarizar(rgba, w, h, limiar)
}

// ── arestas no formato da receita ({from, to, kind}, trechos do mesmo tipo) ─────────────────────────
export interface ArestaReceita { from: number; to: number; kind: TipoAresta }

export function arestasDeTipos(tipos: TipoAresta[]): ArestaReceita[] {
  const n = tipos.length
  if (!n) return []
  let ini = 0
  for (let i = 0; i < n; i++) if (tipos[i] !== tipos[(i - 1 + n) % n]) { ini = i; break }
  const out: ArestaReceita[] = []
  for (let k = 0; k < n; k++) {
    const i = (ini + k) % n
    const u = out[out.length - 1]
    if (u && u.kind === tipos[i]) u.to = (i + 1) % n
    else out.push({ from: i, to: (i + 1) % n, kind: tipos[i] })
  }
  return out
}

export function tiposDeArestas(edges: ArestaReceita[] | undefined, n: number): TipoAresta[] {
  const t: TipoAresta[] = new Array(n).fill('cut')
  for (const e of edges ?? []) {
    let i = e.from, guarda = 0
    do { t[i] = e.kind; i = (i + 1) % n } while (i !== e.to && ++guarda <= n)
  }
  return t
}
