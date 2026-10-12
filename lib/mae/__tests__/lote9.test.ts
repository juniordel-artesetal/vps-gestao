// Lote 9 — uso real da Naty (12/10/2026): cenário contínuo com fonte única (136), duplicar (137), brilho "borda" em
// camada recortada na face (140). Atalhos em atalhos.test.ts; pixels do motor em referencia-pixels.test.ts.
import { describe, it, expect } from 'vitest'
import { createCanvas, Path2D as P2D } from '@napi-rs/canvas'
;(globalThis as { Path2D?: unknown }).Path2D ??= P2D
import { renderizarPrancheta, type CanvasLike } from '@/lib/mae/render/renderizar'
import { novoDocumento } from '@/lib/mae/schema/documento'
import { montarBaseDeMedidas } from '@/lib/mae/medidas/pecas'
import { novoTema, duplicarCamadaTema, colarCamadaTema, acharCamadaTema } from '@/lib/mae/vinculo/tema'
import { arteDaFace, facesDoCenario } from '@/lib/mae/vinculo/cenario'
import { pilhaNoPonto } from '@/lib/mae/vinculo/pilha'
import { matrizDaCamada, efetiva } from '@/lib/mae/vinculo/resolver'
import { quadroDaFace } from '@/lib/mae/vinculo/enquadramento'
import { aplicar } from '@/lib/mae/vinculo/matriz'
import type { DocTema, NoCamada } from '@/lib/mae/schema'
import type { Pt } from '@/lib/mae/faces/geometria'

const criar = (w: number, h: number) => createCanvas(w, h) as unknown as CanvasLike

describe('140 — brilho interno "borda" numa camada recortada na face', () => {
  const k = 4
  const face: NoCamada = { id: 'f:forma', name: 'f', visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal', clip: false, type: 'shape', color: '#000000', rings: [[[20, 20], [80, 20], [80, 60], [20, 60]]] } as never
  // papel AZUL que cobre a folha inteira (maior que a face), recortado na face, com brilho interno vermelho
  const papel = (src: 'edge' | 'center'): NoCamada => ({ id: 'f:papel', name: 'papel', visible: true, locked: false, opacity: 1, fill: 1, blendMode: 'normal', clip: true,
    type: 'solid', color: '#0000ff', xMm: 0, yMm: 0, wMm: 100, hMm: 80,
    effects: [{ type: 'innerGlow', color: '#ff0000', opacity: 0.9, blendMode: 'normal', sizeMm: 3, source: src, enabled: true }] } as never)
  const render = (camadas: NoCamada[]) => {
    const c = createCanvas(100 * k, 80 * k)
    renderizarPrancheta(c as unknown as CanvasLike, { id: 'ab', widthMm: 100, heightMm: 80, layers: camadas } as never, { pxPorMm: k, fundo: '#ffffff', criarCanvas: criar, bitmap: () => undefined })
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    return (xMm: number, yMm: number) => { const i = (Math.round(yMm * k) * c.width + Math.round(xMm * k)) * 4; return [d[i], d[i + 1], d[i + 2]] }
  }
  it('vermelho junto da BORDA DA FACE (antes não aparecia nada) e azul no meio', () => {
    const px = render([face, papel('edge')])
    const borda = px(20.3, 40), dentro = px(22, 40), meio = px(50, 40)
    expect(borda[0]).toBeGreaterThan(70)           // vermelho colado na borda da face (antes: 0)
    expect(dentro[0]).toBeLessThan(borda[0])       // e vai sumindo para dentro (brilho, não faixa)
    expect(meio).toEqual([0, 0, 255])              // o meio continua o papel azul
  })
  it('fora da face continua branco (o papel é recortado)', () => {
    const px = render([face, papel('edge')])
    expect(px(10, 10)).toEqual([255, 255, 255])
  })
})

/** Base com 1 molde de 3 faces vizinhas em linha (A | B | C) numa parte com cenário contínuo. */
function baseCenario() {
  const d = novoDocumento('A4')
  montarBaseDeMedidas(d, [{ nome: 'Caixa', medida: { forma: 'retangulo', larguraMm: 90, alturaMm: 40 } }])
  const m = d.molds[0]
  const f0 = m.faces[0]
  // divide a face única em 3 faces vizinhas (30 mm cada)
  const [x0, y0] = (f0.polygonMm as Pt[])[0]
  m.faces = [0, 1, 2].map(i => ({ ...f0, id: `${f0.id}_${i}`, polygonMm: [[x0 + i * 30, y0], [x0 + (i + 1) * 30, y0], [x0 + (i + 1) * 30, y0 + 40], [x0 + i * 30, y0 + 40]] as never }))
  d.parts = [{ id: 'p_cen', name: 'CENÁRIO', cenario: true, referenceAspect: 2.25, instances: m.faces.map(f => ({ faceId: f.id, moldeId: m.id, fit: { mode: 'cover' } })) }] as never
  const t = novoTema({ nome: 'T', baseId: d.id, baseVersion: 1 }) as DocTema
  t.partContent.p_cen = [{ id: 'el', type: 'image', anchor: 'face', path: 'Elementos/e.png', sha256: 'e', aspect: 1, transform: { x: 0.85, y: 0.5, scale: 0.2, rotationDeg: 0 } }] as never
  return { d, t, m }
}

describe('136 — cenário contínuo: a interação usa o mesmo quadro do desenho (arteDaFace)', () => {
  it('face não líder → as camadas ficam na face LÍDER, quadro das faces juntas', () => {
    const { d, t, m } = baseCenario()
    const fs = facesDoCenario(d, t, m, m.faces[2].id)!
    expect(fs.length).toBe(3)
    const a = arteDaFace(d, t, m, m.faces[2].id)!
    expect(a.faceArte).toBe(fs[0])
    expect(a.parteArte).toBe('p_cen')
  })
  it('o elemento desenhado na 3ª face (perto da direita do cenário) é achado pelo clique nela', () => {
    const { d, t, m } = baseCenario()
    const f = m.faces[2]
    const a = arteDaFace(d, t, m, f.id)!
    const el = efetiva((t.partContent.p_cen as never[])[0], undefined)
    const [cx, cy] = aplicar(matrizDaCamada(el as never, a.quadro, a.A), 0.5, 0.5)
    const q = quadroDaFace(f.polygonMm as Pt[], undefined, 2.25)!
    const comArte = pilhaNoPonto({ doc: d as never, tema: t, faceId: f.id, poligono: f.polygonMm as Pt[], local: [cx, cy], quadro: q, quadroArte: a.quadro, poligonoArte: a.poligono })
    expect(comArte.some(x => x.id === 'el')).toBe(true)
    // sem o quadro da arte (como era antes), o clique no MESMO ponto não achava o elemento
    const semArte = pilhaNoPonto({ doc: d as never, tema: t, faceId: f.id, poligono: f.polygonMm as Pt[], local: [cx, cy], quadro: q })
    expect(semArte.some(x => x.id === 'el')).toBe(false)
  })
})

describe('137 — duplicar e colar camada do tema', () => {
  it('cópia independente, logo acima, deslocada, com o ajuste "só nesta caixa" junto', () => {
    const { t } = baseCenario()
    t.localOverrides = { faceX: { el: { transform: { x: 0.3, y: 0.3 }, opacity: 0.5 } } } as never
    const id = duplicarCamadaTema(t, 'el')!
    const lista = t.partContent.p_cen as { id: string; transform: { x: number; y: number }; name?: string }[]
    expect(lista.map(c => c.id)).toEqual(['el', id])
    expect(lista[1].transform.x).toBeCloseTo(0.89)
    const aj = (t.localOverrides as never as Record<string, Record<string, { transform: { x: number }; opacity: number }>>).faceX
    expect(aj[id].transform.x).toBeCloseTo(0.34)
    expect(aj[id].opacity).toBe(0.5)
    // independente: mexer na cópia não mexe na original
    lista[1].transform.x = 0.1
    expect(lista[0].transform.x).toBeCloseTo(0.85)
  })
  it('colar = cópia nova na parte de destino (papel vai para baixo dos elementos)', () => {
    const { t } = baseCenario()
    const el = acharCamadaTema(t, 'el')!.c
    const id = colarCamadaTema(t, 'p_cen', el)
    expect((t.partContent.p_cen as { id: string }[]).map(c => c.id)).toEqual(['el', id])
    const papel = colarCamadaTema(t, 'p_cen', { ...el, id: 'pp', anchor: 'paper' } as never)
    expect((t.partContent.p_cen as { id: string }[])[0].id).toBe(papel)
  })
})

describe('141 — estilos só nesta caixa', () => {
  it('o efeito gravado na caixa vale só nela; voltar ao padrão tira', async () => {
    const { ajustarSoNaFace, voltarAoPadrao, propriedadesAjustadas } = await import('@/lib/mae/vinculo/tema')
    const { t } = baseCenario()
    const el = acharCamadaTema(t, 'el')!.c
    ajustarSoNaFace(t, 'faceX', 'el', { effects: [{ type: 'stroke', sizeMm: 1, color: '#ff0000', position: 'outside', enabled: true, opacity: 1 }] })
    expect((efetiva(el, (t.localOverrides as never as Record<string, Record<string, never>>).faceX.el) as { effects?: unknown[] }).effects?.length).toBe(1)
    expect((el as { effects?: unknown[] }).effects ?? []).toHaveLength(0)       // a camada (todas as caixas) não muda
    expect(propriedadesAjustadas(t, 'faceX', 'el')).toContain('effects')
    voltarAoPadrao(t, 'faceX', 'el', 'effects')
    expect(propriedadesAjustadas(t, 'faceX', 'el')).toEqual([])
  })
})

describe('146 — cenário contínuo na Base', () => {
  it('faces que não formam uma região só: a arte cobre o retângulo de todas (nenhuma face em branco)', async () => {
    const { poligonoDoCenario } = await import('@/lib/mae/vinculo/cenario')
    const a: Pt[] = [[0, 0], [10, 0], [10, 10], [0, 10]], b: Pt[] = [[30, 0], [40, 0], [40, 10], [30, 10]]   // não encostam
    const p = poligonoDoCenario([a, b])
    const xs = p.map(q => q[0])
    expect(Math.min(...xs)).toBe(0); expect(Math.max(...xs)).toBe(40)
    // faces vizinhas continuam virando um contorno só (exato)
    const c: Pt[] = [[10, 0], [20, 0], [20, 10], [10, 10]]
    expect(poligonoDoCenario([a, c]).length).toBeGreaterThanOrEqual(4)
  })
  it('separar a face do cenário: ela volta a ter enquadramento próprio', () => {
    const { d, t, m } = baseCenario()
    ;(d.parts[0] as { foraDoCenario?: string[] }).foraDoCenario = [m.faces[2].id]
    expect(facesDoCenario(d, t, m, m.faces[2].id)).toBeNull()
    expect(facesDoCenario(d, t, m, m.faces[0].id)).toEqual([m.faces[0].id, m.faces[1].id])
    expect(arteDaFace(d, t, m, m.faces[2].id)!.faceArte).toBe(m.faces[2].id)
  })
})
