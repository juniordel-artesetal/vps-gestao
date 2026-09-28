// SOA Design — FACA (DXF/SVG/PDF/PNG) → MOCKUP DE PRODUTO com as Smart Areas já criadas.
// Lê as linhas (corte + vinco) → acha cada PAINEL (área clara cercada por linhas; o vinco tracejado também separa) →
// reconhece a fileira das paredes (lateral · frente · lateral · verso) e a tampa → monta a caixa lisa em 3D (a mesma
// montagem do Kit de caixas) → cada face visível vira uma Smart Area NOMEADA (frente, lateral direita, tampa…).
// Tudo em coordenadas normalizadas. A artesã só confere/ajusta os pontos. 🔒 A faca é dela.
import { rasterizarMolde } from './mascaraMolde'
import { montagemCuboide, renderMontada } from './montada'
import { idArea, TRANSFORM_PADRAO, type SmartArea } from './mockupFoto'
import type { FaceMolde, FaceRole } from './caixasTipos'

export interface Painel { x: number; y: number; w: number; h: number; px: number }

/** Painéis da faca: componentes claros cercados por linhas (engrossadas `R` px para o vinco tracejado não vazar). */
export function paineisDaFaca(cv: HTMLCanvasElement, R: number): Painel[] {
  const W = cv.width, H = cv.height, N = W * H
  const d = cv.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H).data
  const tinta = new Uint8Array(N)
  for (let i = 0; i < N; i++) {
    const a = d[i * 4 + 3] / 255
    if (a < 0.15) continue
    const r = d[i * 4] * a + 255 * (1 - a), g = d[i * 4 + 1] * a + 255 * (1 - a), b = d[i * 4 + 2] * a + 255 * (1 - a)
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
    if (0.299 * r + 0.587 * g + 0.114 * b < 215 || (mx - mn) / (mx || 1) > 0.3) tinta[i] = 1
  }
  // dilatação separável (linha → muro de 2R+1 px)
  const h1 = new Uint8Array(N), muro = new Uint8Array(N)
  for (let y = 0; y < H; y++) { let ult = -1e9; for (let x = 0; x < W; x++) { if (tinta[y * W + x]) ult = x; if (x - ult <= R) h1[y * W + x] = 1 } ult = 1e9; for (let x = W - 1; x >= 0; x--) { if (tinta[y * W + x]) ult = x; if (ult - x <= R) h1[y * W + x] = 1 } }
  for (let x = 0; x < W; x++) { let ult = -1e9; for (let y = 0; y < H; y++) { if (h1[y * W + x]) ult = y; if (y - ult <= R) muro[y * W + x] = 1 } ult = 1e9; for (let y = H - 1; y >= 0; y--) { if (h1[y * W + x]) ult = y; if (ult - y <= R) muro[y * W + x] = 1 } }
  const rot = new Int32Array(N), fila = new Int32Array(N)
  const out: Painel[] = []
  let n = 0
  for (let s = 0; s < N; s++) {
    if (muro[s] || rot[s]) continue
    n++
    let ini = 0, fim = 0, x0 = W, y0 = H, x1 = 0, y1 = 0, area = 0, borda = false
    rot[s] = n; fila[fim++] = s
    while (ini < fim) {
      const i = fila[ini++], x = i % W, y = (i - x) / W
      area++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) borda = true
      if (x > 0 && !muro[i - 1] && !rot[i - 1]) { rot[i - 1] = n; fila[fim++] = i - 1 }
      if (x < W - 1 && !muro[i + 1] && !rot[i + 1]) { rot[i + 1] = n; fila[fim++] = i + 1 }
      if (y > 0 && !muro[i - W] && !rot[i - W]) { rot[i - W] = n; fila[fim++] = i - W }
      if (y < H - 1 && !muro[i + W] && !rot[i + W]) { rot[i + W] = n; fila[fim++] = i + W }
    }
    if (borda || area < N * 0.003) continue          // fora da faca / sujeira
    // devolve o que o muro "comeu"
    x0 = Math.max(0, x0 - R); y0 = Math.max(0, y0 - R); x1 = Math.min(W - 1, x1 + R); y1 = Math.min(H - 1, y1 + R)
    out.push({ x: x0 / W, y: y0 / H, w: (x1 - x0 + 1) / W, h: (y1 - y0 + 1) / H, px: area })
  }
  return out
}

const sobrepoeY = (a: Painel, b: Painel) => Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)) / Math.min(a.h, b.h)
const sobrepoeX = (a: Painel, b: Painel) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) / Math.min(a.w, b.w)

/** Reconhece as faces de uma caixa (cuboide) pela geometria da faca. `aspecto` = largura/altura da faca rasterizada. */
export function facesDaFaca(ps: Painel[], aspecto: number): { faces: FaceMolde[]; dims: { l: number; p: number; a: number }; avisos: string[] } {
  const avisos: string[] = []
  const X = (p: Painel) => p.w * aspecto                       // largura na mesma unidade da altura
  const maior = [...ps].sort((a, b) => b.px - a.px)[0]
  if (!maior) throw new Error('Não achei nenhum painel fechado nesta faca. Confira se o contorno de corte está fechado.')
  // fileira das paredes: mesma faixa de altura do maior painel
  const fileira = ps.filter(p => sobrepoeY(p, maior) > 0.6 && p.h > maior.h * 0.75 && X(p) > X(maior) * 0.2).sort((a, b) => a.x - b.x)
  const larg = Math.max(...fileira.map(X))
  const largos = fileira.filter(p => X(p) >= larg * 0.8)
  // frente = 1º painel largo com vizinho dos dois lados (senão o 1º largo)
  const iF = fileira.findIndex(p => largos.includes(p) && fileira.indexOf(p) > 0 && fileira.indexOf(p) < fileira.length - 1)
  const frente = fileira[iF >= 0 ? iF : fileira.indexOf(largos[0])]
  const i = fileira.indexOf(frente)
  const esq = i > 0 ? fileira[i - 1] : null, dir = i < fileira.length - 1 ? fileira[i + 1] : null
  const verso = largos.find(p => p !== frente) || null
  const laterais = [esq, dir].filter((p): p is Painel => !!p && p !== verso)
  const tampa = ps.filter(p => p !== frente && sobrepoeX(p, frente) > 0.7 && p.y + p.h <= frente.y + frente.h * 0.1 && p.y + p.h > frente.y - frente.h * 0.15).sort((a, b) => b.y - a.y)[0] || null
  const fundo = ps.filter(p => p !== frente && sobrepoeX(p, frente) > 0.7 && p.y >= frente.y + frente.h * 0.9 && p.y < frente.y + frente.h * 1.15).sort((a, b) => a.y - b.y)[0] || null
  const faces: FaceMolde[] = []
  const add = (role: FaceRole, p: Painel | null) => { if (p) faces.push({ id: role, role, x: p.x, y: p.y, w: p.w, h: p.h, rot: 0, forma: 'retangulo' }) }
  add('frente', frente)
  add('lateral_esquerda', esq && esq !== verso ? esq : null)
  add('lateral_direita', dir && dir !== verso ? dir : null)
  add('tras', verso); add('cima', tampa); add('fundo', fundo)
  const l = X(frente), a = frente.h
  let p = laterais.length ? Math.min(...laterais.map(X)) : tampa ? tampa.h : fundo ? fundo.h : 0
  if (!laterais.length) avisos.push(tampa || fundo ? 'Não achei as laterais: usei a tampa para a profundidade.' : 'Não achei laterais nem tampa: montei como peça plana (tag, cartão, topo).')
  if (!(p > 0)) p = Math.min(l, a) * 0.03
  return { faces, dims: { l: +(l * 100).toFixed(2), p: +(p * 100).toFixed(2), a: +(a * 100).toFixed(2) }, avisos }
}

const NOME_AREA: Record<FaceRole, string> = { frente: 'frente', lateral_esquerda: 'lateral esquerda', lateral_direita: 'lateral direita', tras: 'verso', cima: 'tampa', fundo: 'fundo' }

/** Faca → imagem-base (caixa lisa montada, 3/4) + Smart Areas nomeadas das faces visíveis. */
export async function mockupDaFaca(f: File, op: { lado?: number; cor?: string } = {}): Promise<{ base: HTMLCanvasElement; areas: SmartArea[]; faces: FaceMolde[]; dims: { l: number; p: number; a: number }; avisos: string[] }> {
  const { cv } = await rasterizarMolde(f)
  const R0 = Math.max(2, Math.round(Math.max(cv.width, cv.height) / 220))
  // vinco muito espaçado pode vazar: tenta engrossar mais até achar a fileira das paredes
  let melhor: ReturnType<typeof facesDaFaca> | null = null, erro: Error | null = null
  for (const k of [1, 1.8, 3]) {
    try {
      const r = facesDaFaca(paineisDaFaca(cv, Math.round(R0 * k)), cv.width / cv.height)
      if (!melhor || r.faces.length > melhor.faces.length) melhor = r
      if (r.faces.some(x => x.role.startsWith('lateral'))) break
    } catch (e) { erro = e as Error }
  }
  if (!melhor) throw erro || new Error('Não consegui ler os painéis desta faca.')
  const montagem = montagemCuboide(melhor.faces, melhor.dims)
  const q: Record<string, { x: number; y: number }[]> = {}
  const cx = renderMontada(montagem, melhor.faces, null, cv.width, cv.height, { vista: 'frente34', lado: op.lado || 1600, corBase: op.cor || '#ffffff', saidaQuadros: q })
  // base TRANSPARENTE (o produto já recortado): a cena escolhida em "Usar" entra por trás, com a sombra dela
  const base = cx
  const ordem: FaceRole[] = ['frente', 'lateral_esquerda', 'lateral_direita', 'tras', 'cima', 'fundo']
  const areas: SmartArea[] = melhor.faces.filter(fc => q[fc.id]).sort((a, b) => ordem.indexOf(a.role) - ordem.indexOf(b.role)).map(fc => {
    const [tl, tr, bl, br] = q[fc.id]
    return { id: idArea(), nome: NOME_AREA[fc.role], area: { tipo: 'poligono', pontos: [tl, tr, br, bl], cantos: [0, 1, 2, 3] }, transform: { ...TRANSFORM_PADRAO }, arte: null }
  })
  if (!areas.length) throw new Error('Montei a caixa, mas nenhuma face ficou visível — confira a faca.')
  return { base, areas, faces: melhor.faces, dims: melhor.dims, avisos: melhor.avisos }
}
