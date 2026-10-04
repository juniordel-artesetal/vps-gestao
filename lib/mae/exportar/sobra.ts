// mae-exportar — ARTE INTELIGENTE (Sprint 9): a região de impressão de cada face = o polígono da face
// expandido pela SOBRA (Clipper2, cantos em esquadria) menos as outras faces do molde — assim o conteúdo
// vaza além das arestas de CORTE, mas não invade a face vizinha (que tem a sua própria arte).
// Puro; tudo em mm.
import { differenceD, inflatePathsD, unionD, FillRule, JoinType, EndType, type PathsD } from 'clipper2-ts'
import type { Pt } from '../faces/geometria'

const paraD = (p: Pt[]): { x: number; y: number }[] => p.map(([x, y]) => ({ x, y }))
const deD = (p: { x: number; y: number }[]): Pt[] => p.map(q => [Math.round(q.x * 1000) / 1000, Math.round(q.y * 1000) / 1000])

/** Polígono expandido pela sobra (mm). Esquadria com limite 2 (pontas agudas viram chanfro). */
export function expandir(poly: Pt[], sobraMm: number): Pt[][] {
  if (!sobraMm) return [poly]
  return (inflatePathsD([paraD(poly)], sobraMm, JoinType.Miter, EndType.Polygon, 2, 3) as PathsD).map(deD)
}

/**
 * Região de impressão da face: (face expandida) − (outras faces que não são furo). Devolve anéis (regra
 * par-ímpar) — às vezes mais de um pedaço.
 */
export function regiaoDeImpressao(face: Pt[], outras: Pt[][], sobraMm: number): Pt[][] {
  const exp = expandir(face, sobraMm).map(paraD)
  if (!outras.length) return exp.map(deD)
  const viz = unionD(outras.map(paraD), FillRule.NonZero) as PathsD
  // a própria face nunca é cortada (arredondamento nas bordas comuns não pode comer a face)
  const fora = differenceD(viz, [paraD(face)], FillRule.NonZero, 3) as PathsD
  return (differenceD(exp, fora, FillRule.NonZero, 3) as PathsD).map(deD).filter(p => p.length >= 3)
}

/** Fator para aumentar o papel em volta do centro do quadro, até cobrir a face + sobra (impressão). */
export function fatorDeSobra(w: number, h: number, sobraMm: number): number {
  if (sobraMm <= 0 || w <= 0 || h <= 0) return 1
  return Math.max((w + 2 * sobraMm) / w, (h + 2 * sobraMm) / h) * 1.02
}
