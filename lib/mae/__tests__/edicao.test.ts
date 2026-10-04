// Sprint 10 — FERRAMENTAS DE EDIÇÃO: seleções, pintura, degradês, formas, ajustes, máscara no motor
// (degradê vetorial e pintada, determinística), deformação, e o marco: transição entre dois papéis com
// máscara em degradê sai NÍTIDA no PDF (300 dpi) e bate com a referência (pixelmatch).
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createCanvas, Path2D as P2D } from '@napi-rs/canvas'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { selRetangulo, selElipse, selPoligono, varinha, intervaloDeCores, combinar, inverter, expandir, suavizar, paraMascaraRgba, borda, tudo } from '@/lib/mae/edicao/selecao'
import { perfil, traco, lata, pintarDegrade, tDoDegrade, contaGotas, paleta } from '@/lib/mae/edicao/pintura'
import { formaEmCmds, svgParaCmds, canetaParaCaminho } from '@/lib/mae/edicao/formas'
import { lutDaCurva, aplicarAjuste, aplicarAjustes } from '@/lib/mae/render/ajustes'
import { ajustePadrao, Ajuste, deformacaoNeutra, NOMES_AJUSTE } from '@/lib/mae/schema/edicao'
import { renderizarPrancheta, tamanhoDoCanvas, pxPorMm, type CanvasLike } from '@/lib/mae/render'
import { resolverPrancheta, noForma } from '@/lib/mae/vinculo/resolver'
import { novoDocumento } from '@/lib/mae/schema/documento'
import { DocTema, type NoCamada } from '@/lib/mae/schema'
import { montarPdf } from '@/lib/mae/exportar/pdf'

const soma = (a: Uint8ClampedArray) => a.reduce((s, v) => s + v, 0) / 255
const criar = (w: number, h: number) => createCanvas(w, h) as unknown as CanvasLike
function img(w: number, h: number, f: (x: number, y: number) => [number, number, number, number]) {
  const d = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set(f(x, y), (y * w + x) * 4)
  return d
}

describe('seleções', () => {
  it('letreiro retangular e elíptico', () => {
    expect(soma(selRetangulo(100, 100, 10, 20, 40, 60).a)).toBe(30 * 40)
    expect(soma(selElipse(100, 100, 0, 0, 80, 40).a)).toBeCloseTo(Math.PI * 40 * 20, -1)
  })
  it('laço/laço poligonal: triângulo com área certa (borda antisserrilhada)', () => {
    const s = selPoligono(100, 100, [[10, 10], [90, 10], [10, 90]])
    expect(soma(s.a)).toBeCloseTo(3200, -1)
  })
  it('varinha: contígua pega só a região do clique; não contígua pega todas da mesma cor', () => {
    // dois quadrados vermelhos separados por branco
    const d = img(40, 20, (x, y) => ((x < 10 || x >= 30) && y < 10 ? [255, 0, 0, 255] : [255, 255, 255, 255]))
    expect(soma(varinha(d, 40, 20, 2, 2, 10, true).a)).toBe(100)
    expect(soma(varinha(d, 40, 20, 2, 2, 10, false).a)).toBe(200)
    // tolerância: tom parecido entra só com tolerância maior
    const g = img(10, 1, x => [200 + x * 3, 0, 0, 255])
    expect(soma(varinha(g, 10, 1, 0, 0, 10, true).a)).toBe(4)
    expect(soma(varinha(g, 10, 1, 0, 0, 30, true).a)).toBe(10)
  })
  it('intervalo de cores é suave (meio da tolerância ainda seleciona)', () => {
    const d = img(3, 1, x => [[0, 0, 255, 255], [0, 40, 255, 255], [255, 0, 0, 255]][x] as [number, number, number, number])
    const s = intervaloDeCores(d, 3, 1, [0, 0, 255], 60)
    expect(s.a[0]).toBe(255); expect(s.a[1]).toBeGreaterThan(100); expect(s.a[2]).toBe(0)
  })
  it('somar, subtrair, intersectar, inverter', () => {
    const a = selRetangulo(20, 20, 0, 0, 10, 20), b = selRetangulo(20, 20, 5, 0, 15, 20)
    expect(soma(combinar(a, b, 'somar').a)).toBe(300)
    expect(soma(combinar(a, b, 'subtrair').a)).toBe(100)
    expect(soma(combinar(a, b, 'intersectar').a)).toBe(100)
    expect(soma(combinar(a, b, 'nova').a)).toBe(200)
    expect(soma(inverter(a).a)).toBe(200)
  })
  it('expandir 2 px e contrair 2 px um quadrado de 10', () => {
    const q = selRetangulo(30, 30, 10, 10, 20, 20)
    const e = expandir(q, 2), c = expandir(q, -2)
    expect(soma(e.a)).toBeGreaterThan(14 * 14 - 8); expect(soma(e.a)).toBeLessThanOrEqual(14 * 14)
    expect(soma(c.a)).toBe(36)
  })
  it('suavizar mantém a área e cria rampa na borda', () => {
    const q = selRetangulo(60, 60, 20, 20, 40, 40)
    const s = suavizar(q, 3)
    expect(Math.abs(soma(s.a) - 400)).toBeLessThan(6)
    expect(s.a[30 * 60 + 20]).toBeGreaterThan(60); expect(s.a[30 * 60 + 20]).toBeLessThan(200)
  })
  it('borda (formigas) e virar máscara', () => {
    const q = selRetangulo(10, 10, 2, 2, 8, 8)
    expect(borda(q).reduce((s, v) => s + v, 0)).toBe(20)
    const m = paraMascaraRgba(q)
    expect(m[(5 * 10 + 5) * 4 + 3]).toBe(255); expect(m[3]).toBe(0)
    const sub = paraMascaraRgba(selRetangulo(10, 10, 0, 0, 5, 10), m, 'subtrair')
    expect(sub[(5 * 10 + 3) * 4 + 3]).toBe(0); expect(sub[(5 * 10 + 6) * 4 + 3]).toBe(255)
  })
})

describe('pintura', () => {
  it('perfil do pincel: duro = degrau, macio = rampa', () => {
    expect(perfil(4, 5, 1)).toBe(1); expect(perfil(5, 5, 1)).toBe(0)
    expect(perfil(0, 10, 0)).toBe(1); expect(perfil(5, 10, 0)).toBeCloseTo(0.5, 1)
  })
  it('traço com opacidade 50%: carimbos sobrepostos NÃO escurecem; borracha apaga; respeita a seleção', () => {
    const d = new Uint8ClampedArray(60 * 20 * 4)
    traco(d, 60, 20, [[5, 10], [55, 10]], { raio: 6, dureza: 1, opacidade: 0.5, cor: [255, 0, 0] })
    expect(d[(10 * 60 + 30) * 4 + 3]).toBe(128)
    traco(d, 60, 20, [[30, 10]], { raio: 3, dureza: 1, opacidade: 1, cor: [0, 0, 0], apagar: true })
    expect(d[(10 * 60 + 30) * 4 + 3]).toBe(0)
    const e = new Uint8ClampedArray(60 * 20 * 4)
    traco(e, 60, 20, [[5, 10], [55, 10]], { raio: 6, dureza: 1, opacidade: 1, cor: [0, 0, 255] }, selRetangulo(60, 20, 0, 0, 30, 20))
    expect(e[(10 * 60 + 20) * 4 + 3]).toBe(255); expect(e[(10 * 60 + 40) * 4 + 3]).toBe(0)
  })
  it('lata de tinta contígua e não contígua', () => {
    const d = img(40, 10, x => (x < 10 || x >= 30 ? [255, 255, 255, 255] : [0, 0, 0, 255]))
    expect(lata(d.slice(), 40, 10, 1, 1, [255, 0, 0], 10, true)).toBe(100)
    expect(lata(d.slice(), 40, 10, 1, 1, [255, 0, 0], 10, false)).toBe(200)
  })
  it('degradês: linear, radial, angular e refletido', () => {
    expect(tDoDegrade('linear', 50, 0, 0, 0, 100, 0)).toBeCloseTo(0.5)
    expect(tDoDegrade('radial', 30, 40, 0, 0, 100, 0)).toBeCloseTo(0.5)
    expect(tDoDegrade('angular', 0, 10, 0, 0, 10, 0)).toBeCloseTo(0.25)
    expect(tDoDegrade('reflected', -50, 0, 0, 0, 100, 0)).toBeCloseTo(0.5)
    const d = new Uint8ClampedArray(100 * 1 * 4)
    pintarDegrade(d, 100, 1, 'linear', 0, 0, 100, 0, [{ pos: 0, cor: [0, 0, 0] }, { pos: 1, cor: [255, 255, 255] }])
    expect(d[0]).toBeLessThan(3); expect(d[99 * 4]).toBeGreaterThan(252); expect(Math.abs(d[50 * 4] - 128)).toBeLessThan(3)
  })
  it('conta-gotas e paleta do tema (corte pela mediana, determinístico)', () => {
    const d = img(20, 10, x => (x < 15 ? [240, 100, 150, 255] : [30, 60, 200, 255]))
    expect(contaGotas(d, 20, 10, 2, 2, 1)).toEqual([240, 100, 150])
    const p = paleta([{ d, w: 20, h: 10 }], 4)
    expect(p[0]).toEqual([240, 100, 150]); expect(p).toContainEqual([30, 60, 200])
    expect(paleta([{ d, w: 20, h: 10 }], 4)).toEqual(p)
  })
})

describe('formas e caneta', () => {
  const caixa = (cmds: ReturnType<typeof formaEmCmds>) => {
    const xs: number[] = [], ys: number[] = []
    for (const c of cmds) for (let i = 1; i + 1 < c.length; i += 2) { xs.push(c[i] as number); ys.push(c[i + 1] as number) }
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  }
  it('retângulo arredondado, elipse, polígono, estrela, coração e linha no quadrado da camada', () => {
    for (const k of ['rect', 'ellipse', 'polygon', 'star', 'heart', 'line']) {
      const b = caixa(formaEmCmds(k, { radius: 0.2, sides: 5, inner: 0.4 }))
      expect(b[0]).toBeGreaterThanOrEqual(-0.05); expect(b[2]).toBeLessThanOrEqual(1.05)
    }
    expect(formaEmCmds('star', { sides: 5 }).filter(c => c[0] === 'L').length).toBe(9)
    expect(formaEmCmds('polygon', { sides: 8 }).filter(c => c[0] === 'L').length).toBe(7)
  })
  it('caneta Bézier: arrastar = curva; caminho normalizado na caixa e relido', () => {
    const r = canetaParaCaminho([{ x: 10, y: 10 }, { x: 50, y: 10, hx: 60, hy: 30 }, { x: 30, y: 50 }], true)!
    expect(r.d).toMatch(/^M/); expect(r.d).toContain('C'); expect(r.d.endsWith('Z')).toBe(true)
    const cmds = svgParaCmds(r.d)
    expect(cmds[0][0]).toBe('M'); expect(cmds.flatMap(c => c.slice(1) as number[]).every(v => v >= 0 && v <= 1)).toBe(true)   // a caixa inclui as alças
    expect(cmds.length).toBe(5)
  })
  it('forma vira caminho em mm com preenchimento e traçado', () => {
    const n = noForma('f', { id: 'f', type: 'shape', kind: 'rect', params: { radius: 0, sides: 6, inner: 0.5 }, fill: '#ff0000', stroke: { color: '#000000', widthMm: 1 }, aspect: 2 }, [20, 0, 0, 10, 5, 5])!
    expect(n.d).toBe('M5 5L25 5L25 15L5 15Z')
    expect(n.bboxMm).toEqual([4.5, 4.5, 21, 11])
    expect(n.stroke).toEqual({ color: '#000000', widthMm: 1 })
  })
})

describe('ajustes não destrutivos', () => {
  it('8 ajustes com padrão válido; curva identidade; determinístico', () => {
    expect(Object.keys(NOMES_AJUSTE).length).toBe(8)
    for (const t of Object.keys(NOMES_AJUSTE)) expect(() => ajustePadrao(t as never)).not.toThrow()
    const lut = lutDaCurva([[0, 0], [255, 255]])
    for (let i = 0; i < 256; i += 17) expect(lut[i]).toBe(i)
    const base = img(16, 16, (x, y) => [x * 16, y * 16, 128, 255])
    const a = base.slice(), b = base.slice()
    const lista = Object.keys(NOMES_AJUSTE).map(t => ajustePadrao(t as never))
    aplicarAjustes(a, lista); aplicarAjustes(b, lista)
    expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).toBe(0)
  })
  it('matiz 180° leva vermelho a ciano; preto e branco dá cinza; níveis e mapa de degradê', () => {
    const d = img(1, 1, () => [255, 0, 0, 255])
    aplicarAjuste(d, Ajuste.parse({ type: 'hueSaturation', hue: 180 }))
    expect([d[0], d[1], d[2]]).toEqual([0, 255, 255])
    const c = img(1, 1, () => [200, 50, 50, 255])
    aplicarAjuste(c, ajustePadrao('blackWhite'))
    expect(c[0]).toBe(c[1]); expect(c[1]).toBe(c[2])
    const n = img(1, 1, () => [128, 128, 128, 255])
    aplicarAjuste(n, Ajuste.parse({ type: 'levels', inBlack: 128 }))
    expect(n[0]).toBe(0)
    const g = img(1, 1, () => [255, 255, 255, 255])
    aplicarAjuste(g, Ajuste.parse({ type: 'gradientMap', stops: [{ pos: 0, color: '#000000' }, { pos: 1, color: '#ff8800' }] }))
    expect([g[0], g[1], g[2]]).toEqual([255, 136, 0])
    const o = img(1, 1, () => [100, 100, 100, 255])
    aplicarAjuste(o, Ajuste.parse({ type: 'brightnessContrast', brightness: 50, opacity: 0.5 }))
    expect(o[0]).toBe(125)
  })
})

// ── motor: máscara, deformação ───────────────────────────────────────────────────────────────────
const base = { visible: true, locked: false, opacity: 1, fill: 1, blendMode: 'normal' as const, clip: false }
function renderNos(nos: NoCamada[], wMm: number, hMm: number, k: number, bitmaps: Record<string, unknown> = {}) {
  const p = { id: 'p', widthMm: wMm, heightMm: hMm, layers: nos }
  const { w, h } = tamanhoDoCanvas(p, k)
  const c = createCanvas(w, h)
  renderizarPrancheta(c as unknown as CanvasLike, p, { pxPorMm: k, fundo: '#ffffff', criarCanvas: criar, bitmap: s => bitmaps[s] as CanvasImageSource, criarCaminho: d => new P2D(d) as unknown as Path2D })
  const g = c.getContext('2d')
  return { c, w, h, rgba: g.getImageData(0, 0, w, h).data, px: (x: number, y: number) => Array.from(g.getImageData(Math.floor(x * k), Math.floor(y * k), 1, 1).data).slice(0, 3) }
}
const solida = (id: string, cor: string, extra: Partial<NoCamada> = {}): NoCamada => ({ ...base, id, name: id, type: 'solid', color: cor, xMm: 0, yMm: 0, wMm: 100, hMm: 20, ...extra } as NoCamada)

describe('máscara no motor', () => {
  const grad = { type: 'linear' as const, x0: 0, y0: 0.5, x1: 1, y1: 0.5, stops: [{ pos: 0, alpha: 0 }, { pos: 1, alpha: 1 }], matrix: [100, 0, 0, 20, 0, 0] as [number, number, number, number, number, number] }
  it('degradê da máscara: azul por cima do vermelho, transição contínua e determinística', () => {
    const nos = [solida('a', '#ff0000'), solida('b', '#0000ff', { mask: { enabled: true, invert: false, featherMm: 0, gradient: grad } })]
    const r1 = renderNos(nos, 100, 20, 4), r2 = renderNos(nos, 100, 20, 4)
    expect(Buffer.compare(Buffer.from(r1.rgba), Buffer.from(r2.rgba))).toBe(0)
    expect(r1.px(1, 10)[0]).toBeGreaterThan(240)     // começo: vermelho
    expect(r1.px(99, 10)[2]).toBeGreaterThan(240)    // fim: azul
    const m = r1.px(50, 10); expect(Math.abs(m[0] - m[2])).toBeLessThan(12)
    // monotônico ao longo da linha
    let ant = -1
    for (let x = 0; x < r1.w; x += 7) { const b = r1.rgba[(40 * r1.w + x) * 4 + 2]; expect(b).toBeGreaterThanOrEqual(ant - 1); ant = b }
  })
  it('inverter e desativar; máscara pintada (raster com a matriz da camada) e suavizar', () => {
    const inv = renderNos([solida('a', '#ff0000'), solida('b', '#0000ff', { mask: { enabled: true, invert: true, featherMm: 0, gradient: grad } })], 100, 20, 2)
    expect(inv.px(1, 10)[2]).toBeGreaterThan(240)
    const off = renderNos([solida('a', '#ff0000'), solida('b', '#0000ff', { mask: { enabled: false, invert: false, featherMm: 0, gradient: grad } })], 100, 20, 2)
    expect(off.px(1, 10)).toEqual([0, 0, 255])
    // máscara pintada: metade de cima opaca
    const m = createCanvas(10, 10); const g = m.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 10, 5)
    const ras = { enabled: true, invert: false, featherMm: 0, raster: { src: { path: 'm.png', sha256: 'm' }, matrix: [100, 0, 0, 20, 0, 0] as [number, number, number, number, number, number] } }
    const r = renderNos([solida('a', '#ff0000'), solida('b', '#0000ff', { mask: ras })], 100, 20, 2, { m })
    expect(r.px(50, 3)).toEqual([0, 0, 255]); expect(r.px(50, 17)).toEqual([255, 0, 0])
    const f = renderNos([solida('a', '#ff0000'), solida('b', '#0000ff', { mask: { ...ras, featherMm: 4 } })], 100, 20, 4, { m })
    const meio = f.px(50, 10); expect(meio[0]).toBeGreaterThan(40); expect(meio[2]).toBeGreaterThan(40)
  })
  it('deformação neutra = sem deformação; perspectiva mexe só onde deve', () => {
    const im = createCanvas(40, 40); const g = im.getContext('2d'); g.fillStyle = '#00aa00'; g.fillRect(0, 0, 40, 40); g.fillStyle = '#aa0000'; g.fillRect(0, 0, 20, 40)
    const no = (warp?: unknown): NoCamada => ({ ...base, id: 'i', name: 'i', type: 'image', src: { path: 'x', sha256: 'x' }, xMm: 0, yMm: 0, wMm: 1, hMm: 1, rotationDeg: 0, matrix: [40, 0, 0, 40, 10, 10], ...(warp ? { warp } : {}) } as NoCamada)
    const a = renderNos([no()], 60, 60, 4, { x: im }), b = renderNos([no(deformacaoNeutra(2, 2))], 60, 60, 4, { x: im })
    const diff = pixelmatch(a.rgba, b.rgba, undefined, a.w, a.h, { threshold: 0.1 })
    expect(diff / (a.w * a.h)).toBeLessThan(0.01)
    const persp = { cols: 1, rows: 1, pts: [[0.3, 0], [0.7, 0], [0, 1], [1, 1]] }
    const p = renderNos([no(persp)], 60, 60, 4, { x: im })
    expect(p.px(12, 12)).toEqual([255, 255, 255])  // canto de cima "entrou" (perspectiva)
    expect(p.px(12, 48)).not.toEqual([255, 255, 255])
  })
})

describe('MARCO da Sprint 10: transição entre dois papéis com máscara em degradê', () => {
  const REF = join(process.cwd(), 'lib/mae/__tests__/referencias/mascara-degrade.png')
  function montar() {
    const d = novoDocumento('A4')
    d.artboards = [{ id: 'ab', widthMm: 120, heightMm: 80 }]
    d.molds.push({ id: 'm', name: 'C', artboardId: 'ab', transform: { xMm: 10, yMm: 10, rotationDeg: 0 }, source: { path: 'x.pdf', sha256: '0'.repeat(64), widthMm: 100, heightMm: 60 }, faces: [{ id: 'f', polygonMm: [[0, 0], [100, 0], [100, 60], [0, 60]] }] })
    d.parts.push({ id: 'p', name: 'FRENTE', referenceAspect: 100 / 60, instances: [{ faceId: 'f', fit: { mode: 'cover', scale: 1, offsetX: 0, offsetY: 0, rotationDeg: 0 } }] })
    const tema = DocTema.parse({ schemaVersion: 1, type: 'theme', id: 't', version: 1, baseId: d.id, baseVersion: 1, partContent: { p: [
      { id: 'rosa', type: 'image', anchor: 'paper', path: 'Papéis/rosa.png', sha256: 'rosa', aspect: 100 / 60 },
      { id: 'azul', type: 'image', anchor: 'paper', path: 'Papéis/azul.png', sha256: 'azul', aspect: 100 / 60,
        mask: { enabled: true, gradient: { type: 'linear', x0: 0.3, y0: 0.5, x1: 0.7, y1: 0.5, stops: [{ pos: 0, alpha: 0 }, { pos: 1, alpha: 1 }] } } },
    ] } })
    const listras = (c1: string, c2: string) => { const c = createCanvas(500, 300); const g = c.getContext('2d'); g.fillStyle = c1; g.fillRect(0, 0, 500, 300); g.fillStyle = c2; for (let x = 0; x < 500; x += 50) g.fillRect(x, 0, 25, 300); return c }
    return { d, tema, bitmaps: { rosa: listras('#f9a8d4', '#ec4899'), azul: listras('#93c5fd', '#2563eb') } }
  }
  it('a máscara vai para o nó com a matriz da camada (vetor) e o render a 300 dpi é contínuo e nítido', async () => {
    const { d, tema, bitmaps } = montar()
    const nos = resolverPrancheta(d, 'ab', { tema, modo: 'impressao', sobraMm: 3 })
    const az = nos.find(n => n.id === 'f:azul')!
    expect(az.mask?.gradient?.matrix).toBeTruthy()
    const k = pxPorMm(300)
    const r = renderNos(nos, 120, 80, k, bitmaps)
    // nitidez: o degradê é calculado no pixel final (sem ampliar raster): passo máximo entre vizinhos
    // na faixa da transição (só onde as duas listras são da mesma "fase") é pequeno
    const y = Math.round(40 * k)
    let maxPasso = 0
    for (let x = Math.round(45 * k); x < Math.round(55 * k); x++) {
      const i = (y * r.w + x) * 4, j = i + 4
      const mesmaFase = Math.floor(((x - 10 * k) / k) / 10) === Math.floor(((x + 1 - 10 * k) / k) / 10)   // listras de 10 mm no papel ampliado
      if (mesmaFase) maxPasso = Math.max(maxPasso, Math.abs(r.rgba[i] - r.rgba[j]), Math.abs(r.rgba[i + 2] - r.rgba[j + 2]))
    }
    expect(maxPasso).toBeLessThan(40)   // sem "degraus" grandes
    // a borda da face (corte) continua um degrau de 1 px na aprovação (nítida)
    const ap = renderNos(resolverPrancheta(d, 'ab', { tema, modo: 'aprovacao' }), 120, 80, k, bitmaps)
    const xBorda = Math.round(10 * k)
    expect(Array.from(ap.rgba.slice(((y * ap.w) + xBorda - 2) * 4, ((y * ap.w) + xBorda - 2) * 4 + 3))).toEqual([255, 255, 255])
    expect(ap.rgba[((y * ap.w) + xBorda + 1) * 4 + 1]).toBeLessThan(250)
    // e entra no PDF a 300 dpi, página em mm exatos
    const png = new Uint8Array(r.c.toBuffer('image/png'))
    const pdf = await montarPdf([{ larguraMm: 120, alturaMm: 80, arte: { bytes: png, tipo: 'png', larguraMm: 120, alturaMm: 80 } }], 'degradê')
    expect(pdf.length).toBeGreaterThan(10_000)
  })
  it('bate com a imagem de referência (pixelmatch, 75 dpi)', () => {
    const { d, tema, bitmaps } = montar()
    const r = renderNos(resolverPrancheta(d, 'ab', { tema }), 120, 80, 3, bitmaps)
    const png = PNG.sync.write(Object.assign(new PNG({ width: r.w, height: r.h }), { data: Buffer.from(r.rgba) }))
    if (!existsSync(REF)) writeFileSync(REF, png)   // 1ª execução grava a referência (conferida a olho e commitada)
    const ref = PNG.sync.read(readFileSync(REF))
    expect([ref.width, ref.height]).toEqual([r.w, r.h])
    const diff = pixelmatch(ref.data, r.rgba, undefined, r.w, r.h, { threshold: 0.05 })
    expect(diff / (r.w * r.h)).toBeLessThan(0.001)
  })
  it('ajustes do TEMA chegam ao motor (preto e branco deixa o papel cinza)', () => {
    const { d, tema, bitmaps } = montar()
    tema.partContent.p[1].adjustments = [Ajuste.parse({ type: 'blackWhite' })]
    delete tema.partContent.p[1].mask
    const r = renderNos(resolverPrancheta(d, 'ab', { tema }), 120, 80, 2, bitmaps)
    const [R, G, B] = r.px(60, 40)
    expect(Math.max(R, G, B) - Math.min(R, G, B)).toBeLessThan(3)
  })
  it('seleção cheia vira máscara cheia (nada some)', () => {
    expect(paraMascaraRgba(tudo(4, 4)).filter((_, i) => i % 4 === 3).every(v => v === 255)).toBe(true)
  })
})
