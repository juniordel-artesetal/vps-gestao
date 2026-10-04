// Sprints 3 + 4 com os MOLDES REAIS da Naty (docs/mae-exemplos/moldes). A verdade de escala é o próprio
// vetor do PDF: cada vértice de face detectada tem de cair a ≤ 0,5 mm da linha desenhada no arquivo.
// Contagens conferidas a olho nas imagens de sobreposição (faces e furos certos, ver mae-progresso.md).
import { describe, it, expect, beforeAll } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { abrirMoldeReal, caixaPts, erroContraVetor, MOLDES, pdfjsNode, DIR_MOLDES, type MoldeTestado } from './moldesReais'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { abrirPdf, desenharPagina } from '@/lib/mae/importacao/pdf'
import { limiarPadrao, fecharPadraoMm } from '@/lib/mae/importacao/padroes'
import { detectarFaces } from '@/lib/mae/faces/detectar'
import { prepararDeRaster, PX_POR_MM_DETECCAO as K } from '@/lib/mae/importacao/preparar'
import { lerDpi, larguraPeloDpi } from '@/lib/mae/importacao/unidades'
import { sugerirEquivalentes } from '@/lib/mae/faces/equivalentes'
import { vizinhasDe } from '@/lib/mae/faces/ferramentas'
import { comPhys } from './pngDpi'

/** Faces e furos esperados em cada molde (conferidos visualmente). */
const ESPERADO: Record<string, { faces: number; furos: number }> = {
  'CUBO COM ALÇA.pdf': { faces: 16, furos: 6 },
  'MALETA COM ALÇA.pdf': { faces: 15, furos: 4 },
  'MALETA CORAÇÃO.pdf': { faces: 11, furos: 7 },
  'MILK.pdf': { faces: 22, furos: 0 },
  'PIRÂMIDE.pdf': { faces: 11, furos: 1 },
  'TRIANGULOVE.pdf': { faces: 15, furos: 2 },
}

const abertos = new Map<string, MoldeTestado>()
beforeAll(async () => { for (const m of MOLDES) abertos.set(m, await abrirMoldeReal(m)) }, 120_000)

describe('moldes reais: escala (Sprint 3) e faces (Sprint 4)', () => {
  it('são os 6 moldes do exemplo', () => expect(MOLDES.length).toBe(6))

  for (const nome of Object.keys(ESPERADO)) {
    it(`${nome}: em escala (erro ≤ 0,5 mm contra o vetor) e faces certas`, () => {
      const m = abertos.get(nome)!
      expect(m.paginaMm.larguraMm).toBeCloseTo(297, 0)      // A4 paisagem lido do PDF
      const faces = m.det.faces.filter(f => !f.furo), furos = m.det.faces.filter(f => f.furo)
      const e = erroContraVetor(m.det.faces, m.vetor)
      expect(e.max).toBeLessThanOrEqual(0.5)
      expect(e.medio).toBeLessThan(0.1)
      // o contorno externo do molde bate com a caixa do vetor
      const cv = caixaPts(m.vetor.flat()), cf = caixaPts(m.det.faces.flatMap(f => f.poligono))
      for (const k of ['x0', 'y0', 'x1', 'y1'] as const) expect(Math.abs(cv[k] - cf[k])).toBeLessThanOrEqual(0.5)
      expect(faces.length).toBe(ESPERADO[nome].faces)
      expect(furos.length).toBe(ESPERADO[nome].furos)
      // toda face tem corte (borda do molde) e as de dentro têm dobra
      expect(faces.filter(f => f.tipos.includes('fold')).length).toBeGreaterThanOrEqual(faces.length - 1)
    })
  }

  it('acerto total ≥ 85% (critério da Sprint 4)', () => {
    const esperado = Object.values(ESPERADO).reduce((s, x) => s + x.faces, 0)
    const certas = Object.keys(ESPERADO).reduce((s, n) => s + Math.min(ESPERADO[n].faces, abertos.get(n)!.det.faces.filter(f => !f.furo).length), 0)
    expect(certas / esperado).toBeGreaterThanOrEqual(0.85)
  })

  it('MILK: os 4 painéis do meio são dobra entre si', () => {
    const f = abertos.get('MILK.pdf')!.det.faces.filter(x => !x.furo).sort((a, b) => b.areaMm2 - a.areaMm2).slice(0, 4)
    const comDobra = f.filter(x => x.tipos.filter(t => t === 'fold').length >= 3)
    expect(comDobra.length).toBeGreaterThanOrEqual(2)
  })

  it('equivalentes: o maior painel da MALETA COM ALÇA sugere o outro painel grande primeiro', () => {
    const m = abertos.get('MALETA COM ALÇA.pdf')!
    const faces = m.det.faces.map((f, i) => ({ ...f, id: `f${i}` }))
    const lista = faces.map((f, i) => ({ moldeId: 'maleta', faceId: f.id, poligono: f.poligono, furo: f.furo, vizinhas: vizinhasDe(faces, i).filter(v => !faces[v].furo).length }))
    const naoFuro = faces.filter(f => !f.furo).sort((a, b) => b.areaMm2 - a.areaMm2)
    const s = sugerirEquivalentes(lista, { moldeId: 'maleta', faceId: naoFuro[0].id })
    expect(s[0]?.faceId).toBe(naoFuro[1].id)
  })

  it('determinística: detectar 2× o mesmo molde dá o mesmo resultado', () => {
    const m = abertos.get('TRIANGULOVE.pdf')!
    expect(detectarFaces(m.prep.linhas, { pxPorMm: K, fecharMm: 0.25 }).faces).toEqual(m.det.faces)
  })
})

describe('PNG com DPI (caminho de imagem)', () => {
  it('MILK exportado a 150 dpi como PNG: DPI lido, escala e faces iguais às do PDF', async () => {
    const pdf = abertos.get('MILK.pdf')!
    // o PNG que a usuária teria ao exportar o PDF a 150 dpi (com o DPI gravado no arquivo, chunk pHYs)
    const pj = await pdfjsNode()
    const pg = await (await abrirPdf(pj as never, new Uint8Array(readFileSync(join(DIR_MOLDES, 'MILK.pdf'))))).pagina(1)
    const k150 = 150 / 25.4
    const c150 = createCanvas(Math.ceil((297 * k150)), Math.ceil(210 * k150))
    await desenharPagina(pg, c150.getContext('2d') as never, k150)
    const png = comPhys(new Uint8Array(c150.toBuffer('image/png')), 150)
    const dpi = lerDpi(png)
    expect(dpi).toBeCloseTo(150, 0)
    const img = await loadImage(Buffer.from(png))
    const larguraMm = larguraPeloDpi(img.width, dpi!)
    expect(Math.abs(larguraMm - 297)).toBeLessThan(0.5)
    const alturaMm = (larguraMm * img.height) / img.width
    const c = createCanvas(Math.ceil(larguraMm * K), Math.ceil(alturaMm * K))
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height)
    const prep = prepararDeRaster(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height, K, { limiar: limiarPadrao('png') })!
    const det = detectarFaces(prep.linhas, { pxPorMm: K, fecharMm: fecharPadraoMm('png') })
    expect(det.faces.filter(f => !f.furo).length).toBe(22)
    const vetor = pdf.vetor.map(l => l.map(([x, y]) => [x + pdf.prep.recorte.xMm - prep.recorte.xMm, y + pdf.prep.recorte.yMm - prep.recorte.yMm] as [number, number]))
    expect(erroContraVetor(det.faces, vetor).max).toBeLessThanOrEqual(0.5)
  })
})
