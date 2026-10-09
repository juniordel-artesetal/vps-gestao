// Lote 5 (item 66): CENÁRIO CONTÍNUO — faces vizinhas viram um cenário só (a arte atravessa a dobra, como na lateral
// direita da milk da Masha). Na Base: a PARTE marcada "cenário contínuo" junta as faces dela no mesmo molde. No Tema:
// "só nesta caixa", grupos de faces (`tema.cenarios`). O papel/elemento se ajusta ao retângulo das faces juntas (sem
// esticar); cada face continua recortada no próprio contorno (a dobra continua existindo para corte e linhas). Puro.
import { inflatePathsD, unionD, FillRule, JoinType, EndType, type PathsD } from 'clipper2-ts'
import type { DocTema, DocTrabalho } from '../schema'
import { area, distBorda, type Pt } from '../faces/geometria'

type Doc = DocTrabalho
type Molde = Doc['molds'][number]

/** Contorno das faces juntas (a maior região da união; frestas da dobra fechadas). */
export function poligonoDoCenario(polys: Pt[][]): Pt[] {
  if (polys.length === 1) return polys[0]
  const D = (p: Pt[]) => p.map(([x, y]) => ({ x, y }))
  const u = inflatePathsD(unionD(inflatePathsD(polys.map(D), 0.2, JoinType.Miter, EndType.Polygon, 2, 3) as PathsD, FillRule.NonZero) as PathsD, -0.2, JoinType.Miter, EndType.Polygon, 2, 3) as PathsD
  const aneis = u.map(p => p.map(q => [q.x, q.y] as Pt)).filter(p => p.length >= 3)
  return aneis.sort((a, b) => area(b) - area(a))[0] ?? polys[0]
}

/** As faces (do mesmo molde) que formam o cenário da face — ou null se ela não está num cenário. */
export function facesDoCenario(d: Pick<Doc, 'parts'>, tema: Pick<DocTema, 'cenarios'> | null | undefined, m: Molde, faceId: string): string[] | null {
  const local = tema?.cenarios?.find(g => g.includes(faceId))
  if (local) { const fs = local.filter(id => m.faces.some(f => f.id === id)); return fs.length > 1 ? fs : null }
  const parte = d.parts.find(p => p.instances.some(i => i.faceId === faceId))
  if (!parte?.cenario) return null
  const fs = parte.instances.map(i => i.faceId).filter(id => m.faces.some(f => f.id === id && !f.hole))
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
