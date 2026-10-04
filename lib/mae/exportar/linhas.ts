// mae-exportar — LINHAS DE CORTE E DOBRA da prancheta (mm da prancheta), para:
//   • imprimir por cima da arte em VETOR (ou ocultar), • o contorno da arte pra aprovação,
//   • exportar só as linhas em SVG/DXF (para a máquina de corte).
// Corte = contorno da união das faces + furos; dobra = aresta de uma face que encosta em outra face
// (ou marcada `fold` na detecção). Puro.
import { unionD, inflatePathsD, FillRule, JoinType, EndType, type PathsD } from 'clipper2-ts'
import type { DocTrabalho, NoCaminho } from '../schema'
import { distBorda, type Pt } from '../faces/geometria'

export interface Linhas {
  /** Contornos fechados de corte. */
  corte: Pt[][]
  /** Segmentos de dobra. */
  dobra: [Pt, Pt][]
}

const TOL = 0.35   // mm: aresta "encostada" na outra face

/** Linhas de um molde (mm do molde). */
export function linhasDoMolde(faces: { polygonMm: Pt[]; hole?: boolean; edges?: { from: number; to: number; kind: 'cut' | 'fold' }[] }[]): Linhas {
  const solidas = faces.filter(f => !f.hole)
  const furos = faces.filter(f => f.hole).map(f => f.polygonMm)
  const D = (p: Pt[]) => p.map(([x, y]) => ({ x, y }))
  // união com uma folga mínima (as faces se tocam pela dobra, mas o arredondamento deixa frestas)
  const g = inflatePathsD(solidas.map(f => D(f.polygonMm)), 0.05, JoinType.Miter, EndType.Polygon, 2, 3) as PathsD
  const u = unionD(g, FillRule.NonZero) as PathsD
  const contorno = (inflatePathsD(u, -0.05, JoinType.Miter, EndType.Polygon, 2, 3) as PathsD).map(p => p.map(q => [q.x, q.y] as Pt))
  const corte = [...contorno, ...furos]
  const dobra: [Pt, Pt][] = []
  const chave = (a: Pt, b: Pt) => { const [p, q] = a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? [a, b] : [b, a]; return `${p[0].toFixed(1)},${p[1].toFixed(1)}|${q[0].toFixed(1)},${q[1].toFixed(1)}` }
  const vistos = new Set<string>()
  solidas.forEach((f, i) => {
    const p = f.polygonMm
    for (let k = 0; k < p.length; k++) {
      const a = p[k], b = p[(k + 1) % p.length]
      const marcada = f.edges?.find(e => e.from === k && e.to === (k + 1) % p.length)
      let ehDobra = marcada?.kind === 'fold'
      if (!marcada) {
        const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
        ehDobra = solidas.some((o, j) => j !== i && distBorda(m, o.polygonMm) < TOL)
      }
      if (!ehDobra) continue
      const c = chave(a, b)
      if (vistos.has(c)) continue
      vistos.add(c); dobra.push([a, b])
    }
  })
  return { corte, dobra }
}

/** Linhas de todos os moldes de uma prancheta (mm da prancheta). */
export function linhasDaPrancheta(d: DocTrabalho, artboardId: string): Linhas {
  const out: Linhas = { corte: [], dobra: [] }
  for (const m of d.molds) {
    if (m.artboardId !== artboardId || !m.faces.length) continue
    const [ox, oy] = [m.transform.xMm, m.transform.yMm]
    const l = linhasDoMolde(m.faces as never)
    out.corte.push(...l.corte.map(r => r.map(([x, y]) => [x + ox, y + oy] as Pt)))
    out.dobra.push(...l.dobra.map(([a, b]) => [[a[0] + ox, a[1] + oy], [b[0] + ox, b[1] + oy]] as [Pt, Pt]))
  }
  return out
}

export function deslocar(l: Linhas, dx: number, dy: number): Linhas {
  return { corte: l.corte.map(r => r.map(([x, y]) => [x + dx, y + dy] as Pt)), dobra: l.dobra.map(([a, b]) => [[a[0] + dx, a[1] + dy], [b[0] + dx, b[1] + dy]] as [Pt, Pt]) }
}

const f3 = (v: number) => Math.round(v * 1000) / 1000
export const caminhoCorte = (l: Linhas) => l.corte.map(r => 'M' + r.map(([x, y]) => `${f3(x)} ${f3(y)}`).join('L') + 'Z').join('')
/** Dobra tracejada já "picotada" em traços (desenho igual em qualquer saída: tela, PNG, PDF). */
export function caminhoDobra(l: Linhas, tracoMm = 2, vaoMm = 1.5): string {
  let d = ''
  for (const [a, b] of l.dobra) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.01) continue
    const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L
    for (let s = 0; s < L; s += tracoMm + vaoMm) {
      const e = Math.min(L, s + tracoMm)
      d += `M${f3(a[0] + ux * s)} ${f3(a[1] + uy * s)}L${f3(a[0] + ux * e)} ${f3(a[1] + uy * e)}`
    }
  }
  return d
}

/** Contorno (aprovação) e linhas (impressão) como camadas do motor — o mesmo desenho da tela. */
export function nosDasLinhas(l: Linhas, o: { cor?: string; corDobra?: string; larguraMm?: number; dobra?: boolean } = {}): NoCaminho[] {
  const w = o.larguraMm ?? 0.25
  const comum = { visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal' as const, clip: false, fillNone: true }
  const bb = (pts: Pt[]): [number, number, number, number] => {
    if (!pts.length) return [0, 0, 1, 1]
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
    return [Math.min(...xs) - w, Math.min(...ys) - w, Math.max(...xs) - Math.min(...xs) + 2 * w, Math.max(...ys) - Math.min(...ys) + 2 * w]
  }
  const out: NoCaminho[] = []
  if (l.corte.length) out.push({ ...comum, id: 'linhas:corte', name: 'Corte', type: 'path', d: caminhoCorte(l), color: o.cor ?? '#111111', stroke: { color: o.cor ?? '#111111', widthMm: w }, bboxMm: bb(l.corte.flat()) })
  if (o.dobra !== false && l.dobra.length) out.push({ ...comum, id: 'linhas:dobra', name: 'Dobra', type: 'path', d: caminhoDobra(l), color: o.corDobra ?? '#555555', stroke: { color: o.corDobra ?? '#555555', widthMm: w }, bboxMm: bb(l.dobra.flat()) })
  return out
}

/** Só as linhas, em SVG (mm reais): corte em vermelho contínuo, dobra em azul tracejado. */
export function linhasSvg(l: Linhas, wMm: number, hMm: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${f3(wMm)}mm" height="${f3(hMm)}mm" viewBox="0 0 ${f3(wMm)} ${f3(hMm)}">
  <g id="corte" fill="none" stroke="#ff0000" stroke-width="0.1"><path d="${caminhoCorte(l)}"/></g>
  <g id="dobra" fill="none" stroke="#0000ff" stroke-width="0.1" stroke-dasharray="2 1.5">${l.dobra.map(([a, b]) => `<path d="M${f3(a[0])} ${f3(a[1])}L${f3(b[0])} ${f3(b[1])}"/>`).join('')}</g>
</svg>
`
}

/** Só as linhas, em DXF R12 (mm; $INSUNITS = 4): camadas CORTE e DOBRA (tipo de linha DASHED). Y para cima. */
export function linhasDxf(l: Linhas, hMm: number): string {
  const o: string[] = []
  const p = (...kv: (string | number)[]) => { for (const v of kv) o.push(String(v)) }
  p(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$INSUNITS', 70, 4, 0, 'ENDSEC')
  p(0, 'SECTION', 2, 'TABLES')
  p(0, 'TABLE', 2, 'LTYPE', 70, 2)
  p(0, 'LTYPE', 2, 'CONTINUOUS', 70, 0, 3, 'Solid line', 72, 65, 73, 0, 40, 0)
  p(0, 'LTYPE', 2, 'DASHED', 70, 0, 3, '__ __ __', 72, 65, 73, 2, 40, 3.5, 49, 2, 49, -1.5)
  p(0, 'ENDTAB', 0, 'TABLE', 2, 'LAYER', 70, 2)
  p(0, 'LAYER', 2, 'CORTE', 70, 0, 62, 1, 6, 'CONTINUOUS')
  p(0, 'LAYER', 2, 'DOBRA', 70, 0, 62, 5, 6, 'DASHED')
  p(0, 'ENDTAB', 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES')
  const Y = (y: number) => f3(hMm - y)
  for (const r of l.corte) {
    p(0, 'POLYLINE', 8, 'CORTE', 66, 1, 70, 1)
    for (const [x, y] of r) p(0, 'VERTEX', 8, 'CORTE', 10, f3(x), 20, Y(y))
    p(0, 'SEQEND', 8, 'CORTE')
  }
  for (const [a, b] of l.dobra) p(0, 'LINE', 8, 'DOBRA', 6, 'DASHED', 10, f3(a[0]), 20, Y(a[1]), 11, f3(b[0]), 21, Y(b[1]))
  p(0, 'ENDSEC', 0, 'EOF')
  return o.join('\n') + '\n'
}

/** Caixa envolvente (mm da prancheta) de um molde — para a saída "por molde". */
export function caixaDoMolde(d: DocTrabalho, moldId: string, folgaMm: number): { x: number; y: number; w: number; h: number } | null {
  const m = d.molds.find(x => x.id === moldId)
  if (!m || !m.faces.length) return null
  const pts = m.faces.flatMap(f => f.polygonMm as Pt[])
  const xs = pts.map(p => p[0] + m.transform.xMm), ys = pts.map(p => p[1] + m.transform.yMm)
  const x = Math.min(...xs) - folgaMm, y = Math.min(...ys) - folgaMm
  return { x, y, w: Math.max(...xs) + folgaMm - x, h: Math.max(...ys) + folgaMm - y }
}
