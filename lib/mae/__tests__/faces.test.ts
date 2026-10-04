// Sprint 4 — DETECÇÃO DE FACES: etapas raster, classificação corte/dobra, ferramentas manuais,
// equivalentes. Os casos sintéticos são desenhados à mão numa máscara (sem canvas).
import { describe, it, expect } from 'vitest'
import { binarizar, caixaDaLinha, contorno, expandir, fechar, rotular, type Mascara } from '@/lib/mae/faces/raster'
import { detectarFaces, simplificarComTipos, arestasDeTipos, tiposDeArestas } from '@/lib/mae/faces/detectar'
import { area, areaComSinal, dentro, dividirPoligono, simplificarFechada, type Pt } from '@/lib/mae/faces/geometria'
import { alternarFuro, dividirFace, excluirFace, ima, lacoParaFace, reclassificar, unirFaces, type FaceEdit } from '@/lib/mae/faces/ferramentas'
import { sugerirEquivalentes } from '@/lib/mae/faces/equivalentes'
import { tracarPolilinhas } from '@/lib/mae/importacao/preparar'

const K = 4   // 4 px/mm nos sintéticos (rápido)
const vazia = (wMm: number, hMm: number): Mascara => ({ w: wMm * K, h: hMm * K, d: new Uint8Array(wMm * K * hMm * K) })
const ret = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]
const linha = (m: Mascara, ...polis: Pt[][]) => tracarPolilinhas(m, polis, K)

describe('etapas raster', () => {
  it('binarizar compõe sobre o branco (PNG transparente com traço preto)', () => {
    const rgba = new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 255, 250, 250, 250, 255])
    expect(Array.from(binarizar(rgba, 4, 1, 200).d)).toEqual([1, 0, 1, 0])   // preto, transparente, vermelho, quase branco
  })
  it('fechar pontilhado liga um traço com falhas sem engordar a linha', () => {
    const m = vazia(20, 10)
    for (let x = 0; x < m.w; x++) if (Math.floor(x / 4) % 2 === 0) m.d[20 * m.w + x] = 1   // tracejado 4 px / 4 px
    m.d[20 * m.w + m.w - 1] = 1                                                             // encosta nas 2 bordas
    const antes = rotular(m).n, depois = rotular(fechar(m, 2)).n
    expect(antes).toBe(1)    // tudo uma região só (o pontilhado não separa)
    expect(depois).toBe(2)   // fechado: em cima e embaixo
    expect(fechar(m, 2).d.reduce((s, v) => s + v, 0)).toBe(m.w)   // 1 px de espessura, como era
  })
  it('expandir põe a fronteira no centro da linha', () => {
    const m = vazia(10, 2)
    for (let y = 0; y < m.h; y++) for (let x = 18; x < 22; x++) m.d[y * m.w + x] = 1   // linha de 4 px no meio
    const { rot } = rotular(m)
    const e = expandir(rot, m.w, m.h, () => true)
    expect(e[19]).toBe(e[0]); expect(e[20]).toBe(e[39])
    expect(e[19]).not.toBe(e[20])
  })
  it('contorno pelas bordas dos pixels: quadrado 3×3 = 12 passos, sentido horário', () => {
    const rot = new Int32Array(25); for (let y = 1; y < 4; y++) for (let x = 1; x < 4; x++) rot[y * 5 + x] = 7
    const c = contorno(rot, 5, 5, 7)!
    expect(c.pts.length).toBe(12)
    expect(c.pts[0]).toEqual([1, 1])
    expect(areaComSinal(c.pts)).toBe(9)
    expect(c.fora.every(f => f === 0)).toBe(true)
  })
  it('caixa do desenho', () => {
    const m = vazia(10, 10); m.d[5 * m.w + 7] = 1; m.d[30 * m.w + 12] = 1
    expect(caixaDaLinha(m)).toEqual({ x0: 7, y0: 5, x1: 12, y1: 30 })
  })
})

describe('detecção (sintético)', () => {
  it('dois painéis lado a lado: a linha comum é DOBRA, o resto CORTE', () => {
    const m = vazia(60, 40)
    linha(m, ret(5, 5, 50, 30), [[30, 5], [30, 35]])
    const r = detectarFaces(m, { pxPorMm: K })
    expect(r.faces.length).toBe(2)
    for (const f of r.faces) {
      expect(f.areaMm2).toBeGreaterThan(700); expect(f.areaMm2).toBeLessThan(800)   // 25 × 30
      const dobras = f.poligono.filter((p, i) => f.tipos[i] === 'fold')
      expect(dobras.length).toBe(1)
      const i = f.tipos.indexOf('fold'), a = f.poligono[i], b = f.poligono[(i + 1) % f.poligono.length]
      expect(Math.abs(a[0] - 30)).toBeLessThan(0.3); expect(Math.abs(b[0] - 30)).toBeLessThan(0.3)   // no centro da linha
    }
  })
  it('janela dentro de uma face = FURO; região < 20 mm² some', () => {
    const m = vazia(60, 60)
    linha(m, ret(5, 5, 50, 50), ret(20, 20, 15, 10), ret(40, 40, 3, 3))
    const r = detectarFaces(m, { pxPorMm: K })
    expect(r.faces.filter(f => !f.furo).length).toBe(1)
    expect(r.faces.filter(f => f.furo).length).toBe(1)
    expect(r.descartadas).toBe(1)
    expect(r.faces.find(f => f.furo)!.tipos.every(t => t === 'cut')).toBe(true)
  })
  it('linha que não fecha (fresta de 0,5 mm): "Fechar pontilhado" separa as faces', () => {
    const m = vazia(60, 40)
    linha(m, ret(5, 5, 50, 30), [[30, 5.6], [30, 35]])
    expect(detectarFaces(m, { pxPorMm: K }).faces.length).toBe(1)
    expect(detectarFaces(m, { pxPorMm: K, fecharMm: 0.5 }).faces.length).toBe(2)
  })
  it('tracejado do arquivo marca DOBRA mesmo na borda com o fundo', () => {
    const m = vazia(60, 40)
    linha(m, ret(5, 5, 50, 30))
    const dobras = vazia(60, 40); linha(dobras, [[5, 5], [55, 5]])
    const f = detectarFaces(m, { pxPorMm: K, dobras }).faces[0]
    expect(f.tipos.filter(t => t === 'fold').length).toBe(1)
  })
  it('determinística: 2 rodadas = mesmo resultado', () => {
    const m = vazia(60, 40); linha(m, ret(5, 5, 50, 30), [[30, 5], [30, 35]], [[5, 20], [55, 20]])
    expect(detectarFaces(m, { pxPorMm: K }).faces).toEqual(detectarFaces(m, { pxPorMm: K }).faces)
  })
  it('simplificação mantém o vértice onde o tipo muda', () => {
    const pts: Pt[] = []; for (let x = 0; x < 20; x++) pts.push([x, 0])
    for (let y = 0; y < 5; y++) pts.push([20, y]); for (let x = 20; x > 0; x--) pts.push([x, 5]); for (let y = 5; y > 0; y--) pts.push([0, y])
    const tipos = pts.map((p, i) => (i >= 5 && i < 15 ? 'fold' : 'cut') as 'fold' | 'cut')
    const s = simplificarComTipos(pts, tipos, 1, 1)
    expect(s.poligono).toContainEqual([5, 0]); expect(s.poligono).toContainEqual([15, 0])
  })
  it('arestas da receita ida e volta', () => {
    const t = ['cut', 'cut', 'fold', 'fold', 'cut'] as const
    const e = arestasDeTipos([...t])
    expect(e).toEqual([{ from: 2, to: 4, kind: 'fold' }, { from: 4, to: 2, kind: 'cut' }])
    expect(tiposDeArestas(e, 5)).toEqual([...t])
  })
})

describe('geometria e ferramentas', () => {
  const q = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
  it('dividir polígono pela reta dos 2 cliques', () => {
    const r = dividirPoligono(q(0, 0, 10, 10), [5, -1], [5, 11])!
    expect(area(r.a) + area(r.b)).toBeCloseTo(100)
    expect(area(r.a)).toBeCloseTo(50)
  })
  it('dividir face: aresta nova é DOBRA, as outras herdam', () => {
    const f: FaceEdit = { poligono: q(0, 0, 10, 10), tipos: ['cut', 'cut', 'cut', 'cut'], furo: false, id: 'f1' }
    const out = dividirFace([f], 0, [5, -1], [5, 11])!
    expect(out.length).toBe(2)
    for (const g of out) { expect(g.tipos.filter(t => t === 'fold').length).toBe(1); expect(g.id).toBeUndefined() }
  })
  it('unir duas faces vizinhas = uma face com o contorno de fora', () => {
    const a: FaceEdit = { poligono: q(0, 0, 10, 10), tipos: ['cut', 'fold', 'cut', 'cut'], furo: false }
    const b: FaceEdit = { poligono: q(10, 0, 10, 10), tipos: ['cut', 'cut', 'cut', 'fold'], furo: false }
    const out = unirFaces([a, b], 0, 1, 8)!
    expect(out.length).toBe(1)
    expect(area(out[0].poligono)).toBeGreaterThan(195); expect(area(out[0].poligono)).toBeLessThan(205)
    expect(out[0].tipos.every(t => t === 'cut')).toBe(true)
  })
  it('reclassificar pela geometria: lado colado em outra face = DOBRA', () => {
    const faces: FaceEdit[] = [{ poligono: q(0, 0, 10, 10), tipos: ['cut', 'cut', 'cut', 'cut'], furo: false }, { poligono: q(10, 0, 10, 10), tipos: ['cut', 'cut', 'cut', 'cut'], furo: false }]
    expect(reclassificar(faces, 0).tipos).toEqual(['cut', 'fold', 'cut', 'cut'])
  })
  it('excluir face: a vizinha vira corte ali; furo ↔ face', () => {
    const faces: FaceEdit[] = [{ poligono: q(0, 0, 10, 10), tipos: ['cut', 'fold', 'cut', 'cut'], furo: false }, { poligono: q(10, 0, 10, 10), tipos: ['cut', 'cut', 'cut', 'fold'], furo: false }]
    expect(excluirFace(faces, 1)[0].tipos.every(t => t === 'cut')).toBe(true)
    const f = alternarFuro(faces, 1)
    expect(f[1].furo).toBe(true); expect(f[0].tipos.every(t => t === 'cut')).toBe(true)
  })
  it('laço substitui as faces que cobre', () => {
    const faces: FaceEdit[] = [{ poligono: q(0, 0, 10, 10), tipos: ['cut', 'cut', 'cut', 'cut'], furo: false }, { poligono: q(30, 0, 10, 10), tipos: ['cut', 'cut', 'cut', 'cut'], furo: false }]
    const out = lacoParaFace(faces, q(-1, -1, 12, 12))!
    expect(out.length).toBe(2)
    expect(out.some(f => dentro([5, 5], f.poligono) && f.manual)).toBe(true)
  })
  it('ímã puxa o clique para o centro da linha', () => {
    const m = vazia(20, 20); linha(m, [[10, 0], [10, 20]])
    const p = ima([11.3, 5], m, K, 2)
    expect(Math.abs(p[0] - 10.1)).toBeLessThan(0.3)
    expect(ima([16, 5], m, K, 2)).toEqual([16, 5])   // longe demais: fica onde clicou
  })
  it('Douglas-Peucker fechado tira os pontos colineares', () => {
    const pts: Pt[] = [[0, 0], [5, 0], [10, 0], [10, 5], [10, 10], [5, 10], [0, 10], [0, 5]]
    expect(simplificarFechada(pts, 0.1).length).toBe(4)
  })
})

describe('faces equivalentes', () => {
  it('sugere a face parecida no outro molde (e não a diferente)', () => {
    const faces = [
      { moldeId: 'A', faceId: 'frente', poligono: [[0, 0], [40, 0], [40, 60], [0, 60]] as Pt[], vizinhas: 4 },
      { moldeId: 'A', faceId: 'aba', poligono: [[40, 0], [50, 0], [50, 60], [40, 60]] as Pt[], vizinhas: 1 },
      { moldeId: 'B', faceId: 'frente', poligono: [[0, 0], [60, 0], [60, 90], [0, 90]] as Pt[], vizinhas: 4 },
      { moldeId: 'B', faceId: 'aba', poligono: [[60, 0], [75, 0], [75, 90], [60, 90]] as Pt[], vizinhas: 1 },
    ]
    const s = sugerirEquivalentes(faces, { moldeId: 'A', faceId: 'frente' }, 0.3)
    expect(s[0]).toMatchObject({ moldeId: 'B', faceId: 'frente' })
    expect(s.find(x => x.faceId === 'aba')?.nota ?? 0).toBeLessThan(s[0].nota)
  })
})
