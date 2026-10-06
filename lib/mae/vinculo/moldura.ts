// MOLDURINHA (Lote 1, item 6) — as bordinhas internas das artes da Naty, sem Photoshop: a borda da FACE
// recuada para dentro (Clipper2, o mesmo recurso da silhueta dos apliques) vira um contorno, contínuo ou
// tracejado estilo pesponto, com cantos vivos ou arredondados. Várias camadas = moldura dupla.
import { inflatePathsD, unionD, FillRule, JoinType, EndType, type PathsD } from 'clipper2-ts'
import type { Pt } from '../faces/geometria'
import type { NoCaminho } from '../schema'

export interface ParamsMoldura {
  /** Distância da borda da face até a borda de FORA da linha (mm). */
  offsetMm: number
  widthMm: number
  /** Pesponto: traço e espaço (mm); null = contínua. */
  dash: { onMm: number; offMm: number } | null
  /** 0 = cantos vivos. */
  cornerMm: number
  color: string
}
export const MOLDURA_PADRAO: ParamsMoldura = { offsetMm: 3, widthMm: 0.6, dash: null, cornerMm: 0, color: '#ffffff' }
export const PESPONTO_PADRAO = { onMm: 1.6, offMm: 1 }

const D = (p: Pt[]) => p.map(([x, y]) => ({ x, y }))
const P = (ps: PathsD): Pt[][] => ps.map(p => p.map(q => [q.x, q.y] as Pt)).filter(p => p.length >= 3)
const areaSinal = (p: Pt[]) => { let s = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += p[j][0] * p[i][1] - p[i][0] * p[j][1]; return s / 2 }

/**
 * Linha central da moldura (mm, no mesmo sistema do polígono): a face recuada `offset + espessura/2`.
 * Cantos arredondados: recua `+ raio` com canto vivo e devolve `raio` com canto redondo (raio exato).
 * Face pequena demais para o recuo → [] (a moldura some em vez de virar um risco torto).
 */
export function linhaDaMoldura(poly: Pt[], p: Pick<ParamsMoldura, 'offsetMm' | 'widthMm' | 'cornerMm'>): Pt[][] {
  if (poly.length < 3) return []
  const recuo = Math.max(0, p.offsetMm) + Math.max(0.01, p.widthMm) / 2
  const r = Math.max(0, p.cornerMm)
  const base = unionD([D(poly)], FillRule.NonZero) as PathsD
  let out = inflatePathsD(base, -(recuo + r), JoinType.Miter, EndType.Polygon, 50, 3) as PathsD
  if (r > 0 && out.length) out = inflatePathsD(out, r, JoinType.Round, EndType.Polygon, 2, 3) as PathsD
  // recuo para dentro de uma face simples só gera contornos de fora (face côncava pode virar 2 pedaços)
  return P(out).filter(a => Math.abs(areaSinal(a)) > 0.01)
}

const f3 = (v: number) => Math.round(v * 1000) / 1000

/**
 * Lote 3 (item 32): a moldura como ANEL PREENCHIDO (não mais uma linha com traço). A linha central vira a
 * forma da própria linha (Clipper2: contínua = anel; pesponto = um polígono por traço). Assim os Estilos da
 * camada (traçado, sombra, brilho, chanfro, degradê) contornam a linha EXATA em qualquer face — antes o
 * traçado engrossava a linha central e a "área" da camada virava a face inteira.
 */
export function formaDaMoldura(aneis: Pt[][], p: Pick<ParamsMoldura, 'widthMm' | 'dash' | 'cornerMm'>): Pt[][] {
  const meia = Math.max(0.025, p.widthMm / 2)
  if (!p.dash) {
    const r = inflatePathsD(aneis.map(D), meia, p.cornerMm > 0 ? JoinType.Round : JoinType.Miter, EndType.Joined, 50, 3) as PathsD
    return P(unionD(r, FillRule.NonZero) as PathsD)
  }
  // pesponto: corta a linha (fechada) em traços de `on` mm com espaços de `off` mm, pela distância percorrida
  const on = Math.max(0.1, p.dash.onMm), off = Math.max(0.1, p.dash.offMm)
  const tracos: Pt[][] = []
  for (const a of aneis) {
    const pts = [...a, a[0]]
    let ligado = true, resto = on, atual: Pt[] = [pts[0]]
    for (let i = 1; i < pts.length; i++) {
      let [x0, y0] = pts[i - 1]; const [x1, y1] = pts[i]
      let seg = Math.hypot(x1 - x0, y1 - y0)
      while (seg > 1e-9) {
        const passo = Math.min(seg, resto)
        const t = passo / seg, nx = x0 + (x1 - x0) * t, ny = y0 + (y1 - y0) * t
        if (ligado) atual.push([nx, ny])
        seg -= passo; resto -= passo; x0 = nx; y0 = ny
        if (resto <= 1e-9) {
          if (ligado && atual.length >= 2) tracos.push(atual)
          ligado = !ligado; resto = ligado ? on : off; atual = [[nx, ny]]
        }
      }
    }
    if (ligado && atual.length >= 2) tracos.push(atual)
  }
  if (!tracos.length) return []
  const r = inflatePathsD(tracos.map(D), meia, JoinType.Round, EndType.Butt, 2, 3) as PathsD
  return P(unionD(r, FillRule.NonZero) as PathsD)
}

/** Nó do motor (caminho PREENCHIDO = a forma da linha) da moldura de UMA face; `origem` = canto do molde na folha. */
export function noMoldura(id: string, nome: string, poly: Pt[], origem: [number, number], p: ParamsMoldura): NoCaminho | null {
  const aneis = linhaDaMoldura(poly, p)
  if (!aneis.length) return null
  const forma = formaDaMoldura(aneis, p)
  if (!forma.length) return null
  const d = forma.map(a => 'M' + a.map(([x, y]) => `${f3(x + origem[0])} ${f3(y + origem[1])}`).join('L') + 'Z').join('')
  const xs = forma.flat().map(q => q[0] + origem[0]), ys = forma.flat().map(q => q[1] + origem[1])
  return {
    id, name: nome, visible: true, locked: false, opacity: 1, fill: 1, blendMode: 'normal', clip: true,
    type: 'path', d, color: p.color,
    // caixa = [x0, y0, x1, y1] (como a do texto). Antes ia largura/altura no lugar de x1/y1 e o buffer dos
    // Estilos da camada cortava a moldura numa linha reta (Lote 3, item 32).
    bboxMm: [f3(Math.min(...xs)), f3(Math.min(...ys)), f3(Math.max(...xs)), f3(Math.max(...ys))],
  }
}
