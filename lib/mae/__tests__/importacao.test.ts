// Sprint 3 — IMPORTAÇÃO: unidades, DPI, calibração por largura e por 2 cliques, SVG, DXF, recorte do
// molde e "Organizar" nas pranchetas.
import { describe, it, expect } from 'vitest'
import { comprimentoSvgMm, lerDpi, larguraPeloDpi, pxPorMmDaLargura, pxPorMmDaMedida, tamanhoSvgMm, unidadeDoDxf } from '@/lib/mae/importacao/unidades'
import { prepararDeRaster } from '@/lib/mae/importacao/preparar'
import { organizar, lugarNaFolha, facesParaReceita, facesDaReceita, MARGEM_MM } from '@/lib/mae/editor/moldes'
import { DocBase } from '@/lib/mae/schema'
import { novoDocumento } from '@/lib/mae/schema/documento'
import { cabecalhoJfif } from './pngDpi'

describe('DPI e calibração de imagem', () => {
  it('JPEG JFIF em dpi e em dpcm', () => {
    expect(lerDpi(cabecalhoJfif(300))).toBe(300)
    expect(lerDpi(cabecalhoJfif(118, 2))).toBeCloseTo(299.72, 1)
    expect(lerDpi(cabecalhoJfif(1))).toBeNull()   // densidade 1 = "sem DPI"
  })
  it('arquivo sem DPI → null (a usuária informa a largura)', () => expect(lerDpi(new Uint8Array([1, 2, 3]))).toBeNull())
  it('largura pelo DPI, por largura confirmada e por 2 cliques', () => {
    expect(larguraPeloDpi(2480, 300)).toBeCloseTo(209.97, 1)
    expect(pxPorMmDaLargura(2480, 210)).toBeCloseTo(11.81, 2)
    expect(pxPorMmDaMedida([100, 100], [100 + 300, 100 + 400], 100)).toBe(5)   // 500 px = 100 mm
  })
})

describe('SVG: unidades e viewBox', () => {
  it('comprimentos', () => {
    expect(comprimentoSvgMm('210mm')).toBe(210)
    expect(comprimentoSvgMm('21cm')).toBe(210)
    expect(comprimentoSvgMm('8.5in')).toBeCloseTo(215.9)
    expect(comprimentoSvgMm('72pt')).toBeCloseTo(25.4)
    expect(comprimentoSvgMm('96')).toBeCloseTo(25.4)
    expect(comprimentoSvgMm('100%')).toBeNull()
  })
  it('width/height com unidade valem (e são "confiáveis")', () => {
    expect(tamanhoSvgMm({ width: '297mm', height: '210mm', viewBox: '0 0 1000 707' })).toEqual({ larguraMm: 297, alturaMm: 210, confiavel: true })
  })
  it('só viewBox = px CSS (96/pol), marcado para conferir', () => {
    const t = tamanhoSvgMm({ viewBox: '0 0 960 480' })!
    expect(t.larguraMm).toBeCloseTo(254); expect(t.confiavel).toBe(false)
  })
  it('só a largura + viewBox: altura pela proporção', () => {
    expect(tamanhoSvgMm({ width: '100mm', viewBox: '0 0 200 50' })!.alturaMm).toBe(25)
  })
})

describe('DXF: $INSUNITS', () => {
  const cab = (u: number) => `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n${u}\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n`
  it('mm, cm e polegada', () => {
    expect(unidadeDoDxf(cab(4))?.mmPorUnidade).toBe(1)
    expect(unidadeDoDxf(cab(5))?.mmPorUnidade).toBe(10)
    expect(unidadeDoDxf(cab(1))?.mmPorUnidade).toBe(25.4)
  })
  it('sem unidade (0) ou sem cabeçalho → null = perguntar', () => {
    expect(unidadeDoDxf(cab(0))).toBeNull()
    expect(unidadeDoDxf('0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n')).toBeNull()
  })
})

describe('recorte do molde', () => {
  it('caixa do desenho + 3 mm de margem, em mm', () => {
    const w = 400, h = 300, k = 4
    const rgba = new Uint8ClampedArray(w * h * 4).fill(255)
    for (let y = 100; y < 200; y++) for (let x = 120; x < 280; x++) if (y === 100 || y === 199 || x === 120 || x === 279) rgba.fill(0, (y * w + x) * 4, (y * w + x) * 4 + 3)
    const p = prepararDeRaster(rgba, w, h, k, { margemMm: 3 })!
    expect(p.recorte).toEqual({ xMm: 27, yMm: 22, wMm: 46, hMm: 31 })
    expect(p.linhas.w).toBe(184)
  })
  it('página em branco → null', () => expect(prepararDeRaster(new Uint8ClampedArray(16).fill(255), 2, 2, 1)).toBeNull())
})

describe('Organizar nas pranchetas', () => {
  let n = 0
  const id = () => `ab_n${++n}`
  it('molde largo numa A4 retrato vazia: a folha gira para paisagem (o MILK real, 279,3 × 200,7, cabe)', () => {
    const r = organizar([{ id: 'ab_1', widthMm: 210, heightMm: 297 }], [], [{ wMm: 279.3, hMm: 200.7 }], () => true, id)
    expect(r.pranchetas[0]).toMatchObject({ widthMm: 297, heightMm: 210 })
    expect(r.posicoes[0]).toEqual({ artboardId: 'ab_1', xMm: MARGEM_MM, yMm: MARGEM_MM })
  })
  it('segundo molde grande → prancheta nova; pequeno cabe do lado', () => {
    const r = organizar([{ id: 'ab_1', widthMm: 297, heightMm: 210 }], [{ artboardId: 'ab_1', transform: { xMm: 2, yMm: 2 }, source: { widthMm: 200, heightMm: 190 } }],
      [{ wMm: 260, hMm: 190 }, { wMm: 60, hMm: 50 }], () => false, id)
    expect(r.pranchetas.length).toBe(2)
    expect(r.posicoes[0].artboardId).toBe(r.pranchetas[1].id)
    expect(r.posicoes[1]).toEqual({ artboardId: 'ab_1', xMm: 204, yMm: 2 })
  })
  it('molde maior que A4: folha do tamanho do molde', () => {
    const r = organizar([], [], [{ wMm: 400, hMm: 300 }], () => false, id)
    expect(r.pranchetas[0]).toMatchObject({ widthMm: 404, heightMm: 304 })
  })
  it('lugar livre respeita a margem e o espaço', () => {
    expect(lugarNaFolha(100, 100, [{ x: 2, y: 2, w: 90, h: 40 }], 90, 40)).toEqual({ x: 2, y: 44 })
    expect(lugarNaFolha(100, 100, [{ x: 2, y: 2, w: 96, h: 96 }], 10, 10)).toBeNull()
  })
})

describe('receita da base com moldes e faces', () => {
  it('faces detectadas → receita válida (Zod) → de volta, sem perder ids', () => {
    const doc = novoDocumento('A4')
    const faces = facesParaReceita('m1', [
      { poligono: [[0, 0], [10, 0], [10, 10], [0, 10]], tipos: ['cut', 'fold', 'cut', 'cut'], furo: false, areaMm2: 100 },
      { poligono: [[2, 2], [4, 2], [4, 4]], tipos: ['cut', 'cut', 'cut'], furo: true, areaMm2: 2 },
    ])
    doc.molds = [{ id: 'm1', name: 'MILK', artboardId: doc.artboards[0].id, transform: { xMm: 5, yMm: 5, rotationDeg: 0 },
      source: { path: 'Bases/moldes/MILK.pdf', sha256: 'a'.repeat(64), widthMm: 279.3, heightMm: 200.7, kind: 'pdf', page: 1, crop: { xMm: 8.9, yMm: 4.6, wMm: 279.3, hMm: 200.7 }, calibration: { method: 'vector' } },
      detection: { closeMm: 0.25, threshold: 240 }, faces }]
    const ok = DocBase.safeParse(doc)
    expect(ok.success).toBe(true)
    const volta = facesDaReceita(faces)
    expect(volta.map(f => f.id)).toEqual(['f_m1_1', 'f_m1_2'])
    expect(volta[0].tipos).toEqual(['cut', 'fold', 'cut', 'cut'])
    expect(volta[1].furo).toBe(true)
    // face nova sem id ganha o próximo número livre
    expect(facesParaReceita('m1', [...volta, { poligono: [[0, 0], [1, 0], [1, 1]], tipos: ['cut', 'cut', 'cut'], furo: false }]).map(f => f.id)).toEqual(['f_m1_1', 'f_m1_2', 'f_m1_3'])
  })
})
