// Lote 5 (item 66): CENÁRIO CONTÍNUO — faces vizinhas viram um cenário só (a arte atravessa a dobra, como na lateral
// direita da milk da Masha). Na Base: a PARTE marcada "cenário contínuo" junta as faces dela no mesmo molde. No Tema:
// "só nesta caixa", grupos de faces (`tema.cenarios`). O papel/elemento se ajusta ao retângulo das faces juntas (sem
// esticar); cada face continua recortada no próprio contorno (a dobra continua existindo para corte e linhas). Puro.
import { inflatePathsD, unionD, FillRule, JoinType, EndType, type PathsD } from 'clipper2-ts'
import type { DocTema, DocTrabalho } from '../schema'
import { area, distBorda, type Pt } from '../faces/geometria'
import { quadroDaFace, type Quadro } from './enquadramento'

type Doc = DocTrabalho
type Molde = Doc['molds'][number]

/**
 * Contorno das faces juntas (frestas da dobra fechadas). Lote 9 (item 146): quando as faces NÃO formam uma região só
 * (não encostam, ou o cenário pega faces de pontas opostas do molde), a arte passa a cobrir o RETÂNGULO de todas —
 * antes ficava só a maior região e as outras faces saíam EM BRANCO no Enquadramento e na arte.
 */
export function poligonoDoCenario(polys: Pt[][]): Pt[] {
  if (polys.length === 1) return polys[0]
  const D = (p: Pt[]) => p.map(([x, y]) => ({ x, y }))
  const u = inflatePathsD(unionD(inflatePathsD(polys.map(D), 0.2, JoinType.Miter, EndType.Polygon, 2, 3) as PathsD, FillRule.NonZero) as PathsD, -0.2, JoinType.Miter, EndType.Polygon, 2, 3) as PathsD
  const aneis = u.map(p => p.map(q => [q.x, q.y] as Pt)).filter(p => p.length >= 3 && area(p) > 1)
  if (aneis.length === 1) return aneis[0]
  const xs = polys.flat().map(p => p[0]), ys = polys.flat().map(p => p[1])
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
}

/**
 * Lote 9 (item 135): o contorno do cenário é o mesmo para todas as faces dele e só muda quando os moldes mudam — antes
 * a união (Clipper) era refeita para CADA face, a CADA mudança no tema (N faces × união de N). Guardado por molde
 * (identidade das faces, mantida pelo histórico) + as faces do grupo.
 */
const cachePoligono = new WeakMap<object, Map<string, Pt[]>>()
export function poligonoDoCenarioDoMolde(m: Molde, faces: string[]): Pt[] {
  let porMolde = cachePoligono.get(m.faces)
  if (!porMolde) { porMolde = new Map(); cachePoligono.set(m.faces, porMolde) }
  const chave = faces.join('|')
  let p = porMolde.get(chave)
  if (!p) { p = poligonoDoCenario(faces.map(id => m.faces.find(x => x.id === id)!.polygonMm as Pt[])); porMolde.set(chave, p) }
  return p
}

/** As faces (do mesmo molde) que formam o cenário da face — ou null se ela não está num cenário. */
export function facesDoCenario(d: Pick<Doc, 'parts'>, tema: Pick<DocTema, 'cenarios'> | null | undefined, m: Molde, faceId: string): string[] | null {
  const local = tema?.cenarios?.find(g => g.includes(faceId))
  if (local) { const fs = local.filter(id => m.faces.some(f => f.id === id)); return fs.length > 1 ? fs : null }
  const parte = d.parts.find(p => p.instances.some(i => i.faceId === faceId))
  if (!parte?.cenario) return null
  // Lote 9 (item 146): face separada do cenário (enquadramento próprio) não entra
  const fora = new Set((parte as { foraDoCenario?: string[] }).foraDoCenario ?? [])
  if (fora.has(faceId)) return null
  const fs = parte.instances.map(i => i.faceId).filter(id => !fora.has(id) && m.faces.some(f => f.id === id && !f.hole))
  return fs.length > 1 ? fs : null
}

/** Faces vizinhas (encostadas pela borda) no mesmo molde — para "juntar só nesta caixa". */
export function vizinhasNoMolde(m: Molde, faceId: string): string[] {
  const f = m.faces.find(x => x.id === faceId)
  if (!f) return []
  const p = f.polygonMm as Pt[]
  return m.faces.filter(o => o.id !== faceId && !o.hole && p.some((a, i) => { const b = p[(i + 1) % p.length]; return distBorda([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], o.polygonMm as Pt[]) < 0.6 })).map(o => o.id)
}

/** Aspecto (largura/altura) do retângulo das faces juntas — vira a referência da parte-cenário. */
export function aspectoDoCenario(polys: Pt[][]): number {
  const xs = polys.flat().map(p => p[0]), ys = polys.flat().map(p => p[1])
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys)
  return h > 0 ? Math.round((w / h) * 1000) / 1000 : 1
}

/**
 * Lote 6 (item 104): o cenário é UMA PEÇA SÓ — todas as faces dele usam a arte da FACE LÍDER (a 1ª do grupo): uma
 * camada, um controle de escala, posição e giro. Antes, faces de partes diferentes (FUNDO 1 + FUNDO 2) tinham cada
 * uma a sua camada e mexer na escala mudava só uma. Devolve a face líder (e a parte dela) ou null.
 */
export function liderDoCenario(d: Pick<Doc, 'parts' | 'molds'>, tema: Pick<DocTema, 'cenarios'> | null | undefined, faceId: string): { faceId: string; parteId: string | null } | null {
  const m = d.molds.find(mm => mm.faces.some(f => f.id === faceId))
  if (!m) return null
  const fs = facesDoCenario(d, tema, m, faceId)
  if (!fs) return null
  const lider = fs[0]
  return { faceId: lider, parteId: d.parts.find(p => p.instances.some(i => i.faceId === lider))?.id ?? null }
}

/** Lote 6 (item 104): nome distinto de cada face no "juntar com…" — "FUNDO 1", "FUNDO 2" (parte + número no molde). */
export function nomeDaFaceNoMolde(d: Pick<Doc, 'parts' | 'molds'>, faceId: string): string {
  const parte = d.parts.find(p => p.instances.some(i => i.faceId === faceId))
  const m = d.molds.find(mm => mm.faces.some(f => f.id === faceId))
  if (!parte || !m) return `face ${faceId.split('_').pop()}`
  const daParteNoMolde = parte.instances.map(i => i.faceId).filter(id => m.faces.some(f => f.id === id))
  return daParteNoMolde.length > 1 ? `${parte.name} ${daParteNoMolde.indexOf(faceId) + 1}` : parte.name
}

/**
 * Lote 9 (item 136): onde a ARTE de uma face é desenhada — FONTE ÚNICA para o resolvedor e para a interação (clique,
 * pilha, contorno, arrastar, soltar elemento, "só nesta caixa"). Numa face de cenário contínuo a arte usa o contorno
 * das faces JUNTAS, o enquadramento e a parte da face LÍDER, e as camadas/ajustes ficam na face líder. Antes, a
 * interação usava o quadro da face clicada: o clique, o contorno e o arrastar erravam o lugar nessas partes, e o
 * elemento solto numa face não líder ia para uma lista que nunca era desenhada.
 */
export interface ArteDaFace {
  /** Quadro (enquadramento) em que as camadas são desenhadas. */
  quadro: Quadro
  /** Contorno da arte (o da face, ou o das faces juntas). */
  poligono: Pt[]
  /** Face que guarda as camadas e os ajustes "só nesta caixa" (a líder, no cenário). */
  faceArte: string
  /** Parte das camadas (a da face líder, no cenário). */
  parteArte: string | null
  /** Aspecto de referência da parte da arte. */
  A: number
}
export function arteDaFace(d: Pick<Doc, 'parts' | 'molds'>, tema: Pick<DocTema, 'cenarios'> | null | undefined, m: Molde, faceId: string): ArteDaFace | null {
  const f = m.faces.find(x => x.id === faceId)
  if (!f) return null
  const parte = d.parts.find(p => p.instances.some(i => i.faceId === faceId)) ?? null
  const doCenario = facesDoCenario(d, tema, m, faceId)
  const lid = doCenario ? liderDoCenario(d, tema, faceId) : null
  const parteQ = lid?.parteId ? d.parts.find(p => p.id === lid.parteId) ?? parte : parte
  const inst = parteQ?.instances.find(i => i.faceId === (lid?.faceId ?? faceId)) ?? parte?.instances.find(i => i.faceId === faceId)
  const A = parteQ?.referenceAspect ?? 1
  const poligono = doCenario ? poligonoDoCenarioDoMolde(m, doCenario) : f.polygonMm as Pt[]
  return { quadro: quadroDaFace(poligono, inst?.fit, A), poligono, faceArte: lid?.faceId ?? faceId, parteArte: parteQ?.id ?? null, A }
}
