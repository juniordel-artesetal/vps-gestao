// mae-faces — FERRAMENTAS MANUAIS (puras): ímã nas linhas, laço poligonal, dividir face, unir faces,
// excluir, e a reclassificação corte/dobra pela geometria depois de cada ajuste.
import { area, caixa, centroide, dentro, distBorda, dividirPoligono, type Pt } from './geometria'
import { contorno, fechar, type Mascara } from './raster'
import { simplificarComTipos, type TipoAresta } from './detectar'

/** Face em edição. `id` acompanha a face enquanto ela não é refeita (dividir/unir/laço geram ids novos). */
export interface FaceEdit { poligono: Pt[]; tipos: TipoAresta[]; furo: boolean; id?: string; manual?: boolean }

// ── ímã ───────────────────────────────────────────────────────────────────────────────────────────
/**
 * Puxa o ponto (mm do molde) para o centro da linha mais próxima, dentro de `raioMm`. Sem linha por
 * perto, devolve o próprio ponto.
 */
export function ima(pt: Pt, linhas: Mascara, pxPorMm: number, raioMm = 2): Pt {
  const cx = pt[0] * pxPorMm, cy = pt[1] * pxPorMm, r = Math.ceil(raioMm * pxPorMm)
  let melhor = -1, dmin = Infinity
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(linhas.h - 1, Math.ceil(cy + r)); y++)
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(linhas.w - 1, Math.ceil(cx + r)); x++) {
      if (!linhas.d[y * linhas.w + x]) continue
      const d = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2
      if (d < dmin) { dmin = d; melhor = y * linhas.w + x }
    }
  if (melhor < 0 || dmin > r * r) return pt
  // centro da linha: média dos pixels de linha num raio de 2 px em volta do mais próximo
  const mx = melhor % linhas.w, my = (melhor - mx) / linhas.w
  let sx = 0, sy = 0, n = 0
  for (let y = my - 2; y <= my + 2; y++) for (let x = mx - 2; x <= mx + 2; x++)
    if (x >= 0 && y >= 0 && x < linhas.w && y < linhas.h && linhas.d[y * linhas.w + x]) { sx += x + 0.5; sy += y + 0.5; n++ }
  return [Math.round((sx / n / pxPorMm) * 100) / 100, Math.round((sy / n / pxPorMm) * 100) / 100]
}

// ── classificação pela geometria (depois de ajustes manuais) ────────────────────────────────────
const SONDA_MM = 0.5, PASSO_MM = 0.5

/**
 * Reclassifica as arestas da face `i`: amostra cada aresta a cada 0,5 mm e olha 0,5 mm para FORA; caiu
 * dentro de outra face (que não é furo) = DOBRA, senão CORTE. Onde o tipo muda no meio de uma aresta,
 * entra um vértice novo.
 */
export function reclassificar(faces: FaceEdit[], i: number): FaceEdit {
  const f = faces[i]
  if (f.furo) return { ...f, tipos: f.poligono.map(() => 'cut') }
  const outras = faces.filter((g, k) => k !== i && !g.furo)
  const tipoEm = (p: Pt, nx: number, ny: number): TipoAresta => {
    let q: Pt = [p[0] + nx * SONDA_MM, p[1] + ny * SONDA_MM]
    if (dentro(q, f.poligono)) q = [p[0] - nx * SONDA_MM, p[1] - ny * SONDA_MM]
    return outras.some(g => dentro(q, g.poligono)) ? 'fold' : 'cut'
  }
  const pol: Pt[] = [], tipos: TipoAresta[] = []
  const n = f.poligono.length
  for (let k = 0; k < n; k++) {
    const a = f.poligono[k], b = f.poligono[(k + 1) % n]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (len < 1e-9) continue
    const nx = (b[1] - a[1]) / len, ny = -(b[0] - a[0]) / len
    const amostras = Math.max(1, Math.floor(len / PASSO_MM))
    let atual: TipoAresta | null = null
    pol.push(a)
    for (let s = 0; s < amostras; s++) {
      const t = (s + 0.5) / amostras
      const tp = tipoEm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], nx, ny)
      if (atual === null) { atual = tp; tipos.push(tp) }
      else if (tp !== atual) {
        const tq = s / amostras
        pol.push([Math.round((a[0] + (b[0] - a[0]) * tq) * 100) / 100, Math.round((a[1] + (b[1] - a[1]) * tq) * 100) / 100])
        tipos.push(tp); atual = tp
      }
    }
  }
  return { ...f, poligono: pol, tipos }
}

/** Faces que encostam na face i (alguma ponta a menos de 0,6 mm da borda). */
export function vizinhasDe(faces: FaceEdit[], i: number): number[] {
  const f = faces[i], cf = caixa(f.poligono)
  const out: number[] = []
  faces.forEach((g, k) => {
    if (k === i) return
    const cg = caixa(g.poligono)
    if (cg.x0 > cf.x1 + 1 || cg.x1 < cf.x0 - 1 || cg.y0 > cf.y1 + 1 || cg.y1 < cf.y0 - 1) return
    if (g.poligono.some(p => distBorda(p, f.poligono) < 0.6) || f.poligono.some(p => distBorda(p, g.poligono) < 0.6)) out.push(k)
  })
  return out
}

/** Reclassifica as faces indicadas e as vizinhas delas. */
export function reclassificarEmVolta(faces: FaceEdit[], indices: number[]): FaceEdit[] {
  const alvo = new Set(indices)
  for (const i of indices) if (i >= 0 && i < faces.length) for (const v of vizinhasDe(faces, i)) alvo.add(v)
  const out = faces.slice()
  for (const i of [...alvo].sort((a, b) => a - b)) if (i >= 0 && i < out.length) out[i] = reclassificar(out, i)
  return out
}

// ── edições ───────────────────────────────────────────────────────────────────────────────────────
/** Divide a face i pela reta p–q (2 cliques). A aresta nova é DOBRA; as outras herdam o tipo. */
export function dividirFace(faces: FaceEdit[], i: number, p: Pt, q: Pt): FaceEdit[] | null {
  const f = faces[i]
  const r = dividirPoligono(f.poligono, p, q)
  if (!r) return null
  const herda = (origem: number[]): TipoAresta[] => origem.map(o => (o < 0 ? 'fold' : f.tipos[o] ?? 'cut'))
  const a: FaceEdit = { poligono: r.a, tipos: herda(r.origemA), furo: f.furo, manual: true }
  const b: FaceEdit = { poligono: r.b, tipos: herda(r.origemB), furo: f.furo, manual: true }
  if (area(a.poligono) < 1 || area(b.poligono) < 1) return null
  const out = faces.slice()
  out.splice(i, 1, a, b)
  return out
}

/** Excluir face(s): some e as vizinhas passam a ter corte onde encostavam nela. */
export function excluirFace(faces: FaceEdit[], i: number): FaceEdit[] {
  const viz = vizinhasDe(faces, i).map(v => (v > i ? v - 1 : v))
  const out = faces.filter((_, k) => k !== i)
  return reclassificarEmVolta(out, viz)
}

/** Preenche um polígono (px) numa máscara (regra par-ímpar, pelo centro dos pixels). */
export function preencherPoligono(m: Mascara, poly: Pt[]): void {
  const c = caixa(poly)
  for (let y = Math.max(0, Math.floor(c.y0)); y <= Math.min(m.h - 1, Math.ceil(c.y1)); y++) {
    const yc = y + 0.5
    const xs: number[] = []
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [x1, y1] = poly[j], [x2, y2] = poly[i]
      if ((y1 > yc) !== (y2 > yc)) xs.push(x1 + ((yc - y1) * (x2 - x1)) / (y2 - y1))
    }
    xs.sort((a, b) => a - b)
    for (let k = 0; k + 1 < xs.length; k += 2)
      for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(m.w - 1, Math.floor(xs[k + 1] - 0.5)); x++) m.d[y * m.w + x] = 1
  }
}

/**
 * Une as faces i e j: rasteriza as duas (fecha a fresta da linha entre elas), refaz o contorno e
 * reclassifica. null se não encostam.
 */
export function unirFaces(faces: FaceEdit[], i: number, j: number, pxPorMm: number): FaceEdit[] | null {
  if (i === j || !vizinhasDe(faces, i).includes(j)) return null
  const ci = caixa(faces[i].poligono), cj = caixa(faces[j].poligono)
  const x0 = Math.min(ci.x0, cj.x0) - 2, y0 = Math.min(ci.y0, cj.y0) - 2
  const w = Math.ceil((Math.max(ci.x1, cj.x1) + 2 - x0) * pxPorMm), h = Math.ceil((Math.max(ci.y1, cj.y1) + 2 - y0) * pxPorMm)
  let m: Mascara = { w, h, d: new Uint8Array(w * h) }
  const px = (p: Pt[]) => p.map(([x, y]) => [(x - x0) * pxPorMm, (y - y0) * pxPorMm] as Pt)
  preencherPoligono(m, px(faces[i].poligono))
  preencherPoligono(m, px(faces[j].poligono))
  m = fechar(m, 2)
  const rot = new Int32Array(w * h)
  for (let p = 0; p < w * h; p++) rot[p] = m.d[p] ? 1 : 0
  const c = contorno(rot, w, h, 1)
  if (!c) return null
  const s = simplificarComTipos(c.pts, c.pts.map(() => 'cut'), Math.max(1, 0.1 * pxPorMm), pxPorMm)
  const unida: FaceEdit = { poligono: s.poligono.map(([x, y]) => [Math.round((x / pxPorMm + x0) * 100) / 100, Math.round((y / pxPorMm + y0) * 100) / 100]), tipos: s.tipos, furo: false, manual: true }
  const out = faces.filter((_, k) => k !== i && k !== j)
  const pos = Math.min(i, j)
  out.splice(pos, 0, unida)
  return reclassificarEmVolta(out, [pos])
}

/** Laço poligonal: vira face nova; as faces cujo centro cai dentro do laço são substituídas. */
export function lacoParaFace(faces: FaceEdit[], laco: Pt[]): FaceEdit[] | null {
  if (laco.length < 3 || area(laco) < 1) return null
  const restantes = faces.filter(f => !dentro(centroide(f.poligono), laco))
  const nova: FaceEdit = { poligono: laco.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]), tipos: laco.map(() => 'cut'), furo: false, manual: true }
  const out = [...restantes, nova]
  return reclassificarEmVolta(out, [out.length - 1])
}

/** Furo ↔ face. */
export function alternarFuro(faces: FaceEdit[], i: number): FaceEdit[] {
  const out = faces.slice()
  out[i] = { ...out[i], furo: !out[i].furo, manual: true }
  return reclassificarEmVolta(out, [i])
}
