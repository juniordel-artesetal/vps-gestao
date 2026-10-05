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

/** Nó do motor (caminho só com traçado) da moldura de UMA face; `origem` = canto do molde na folha. */
export function noMoldura(id: string, nome: string, poly: Pt[], origem: [number, number], p: ParamsMoldura): NoCaminho | null {
  const aneis = linhaDaMoldura(poly, p)
  if (!aneis.length) return null
  const d = aneis.map(a => 'M' + a.map(([x, y]) => `${f3(x + origem[0])} ${f3(y + origem[1])}`).join('L') + 'Z').join('')
  const xs = aneis.flat().map(q => q[0] + origem[0]), ys = aneis.flat().map(q => q[1] + origem[1]), sw = p.widthMm / 2
  return {
    id, name: nome, visible: true, locked: false, opacity: 1, fill: 1, blendMode: 'normal', clip: true,
    type: 'path', d, color: p.color, fillNone: true,
    stroke: { color: p.color, widthMm: Math.max(0.05, p.widthMm), ...(p.dash ? { dashMm: [Math.max(0.1, p.dash.onMm), Math.max(0.1, p.dash.offMm)] as [number, number] } : {}) },
    bboxMm: [f3(Math.min(...xs) - sw), f3(Math.min(...ys) - sw), f3(Math.max(...xs) - Math.min(...xs) + 2 * sw), f3(Math.max(...ys) - Math.min(...ys) + 2 * sw)],
  }
}
