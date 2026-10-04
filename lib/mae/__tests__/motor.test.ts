// Motor de render (Sprint 2): mesclagem, opacidade × preenchimento, máscara de recorte, grupos,
// cache e determinismo. Roda no Node com @napi-rs/canvas (Skia — o mesmo motor gráfico do Chrome).
import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { renderizarPrancheta, tamanhoDoCanvas, CacheCamadas, chaveRaster, type CanvasLike, type ResolverBitmap } from '@/lib/mae/render'
import { Prancheta as PranchetaZ, type NoCamada, type Prancheta } from '@/lib/mae/schema'

const criar = (w: number, h: number) => createCanvas(w, h) as unknown as CanvasLike
let n = 0
const base = { name: 'c', visible: true, locked: false, opacity: 1, fill: 1, blendMode: 'normal' as const, clip: false }
const solida = (color: string, x = 0, y = 0, w = 10, h = 10, extra: Partial<NoCamada> = {}): NoCamada =>
  ({ ...base, id: `s${n++}`, type: 'solid', color, xMm: x, yMm: y, wMm: w, hMm: h, ...extra } as NoCamada)
const grupo = (children: NoCamada[], extra: Partial<NoCamada> = {}): NoCamada =>
  ({ ...base, id: `g${n++}`, type: 'group', passThrough: true, children, ...extra } as NoCamada)
const folha = (layers: NoCamada[], w = 10, h = 10): Prancheta => ({ id: 'p1', widthMm: w, heightMm: h, layers })

function render(p: Prancheta, pxPorMm = 1, fundo: string | null = '#ffffff', bitmap: ResolverBitmap = () => undefined) {
  const { w, h } = tamanhoDoCanvas(p, pxPorMm)
  const c = createCanvas(w, h)
  const r = renderizarPrancheta(c as unknown as CanvasLike, p, { pxPorMm, fundo, criarCanvas: criar, bitmap })
  return { c, r, px: (x: number, y: number) => Array.from(c.getContext('2d').getImageData(x, y, 1, 1).data) }
}
const hex = (s: string) => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16))
const perto = (a: number[], b: number[], tol = 2) => a.every((v, i) => Math.abs(v - b[i]) <= tol)

describe('modos de mesclagem (matemática dos separáveis)', () => {
  const A = '#c86432', B = '#3296e1'   // fundo (base) e topo
  const a = hex(A).map(v => v / 255), b = hex(B).map(v => v / 255)
  const formulas: Record<string, (x: number, y: number) => number> = {
    multiply: (x, y) => x * y,
    screen: (x, y) => x + y - x * y,
    darken: Math.min,
    lighten: Math.max,
    difference: (x, y) => Math.abs(x - y),
    exclusion: (x, y) => x + y - 2 * x * y,
  }
  for (const [modo, f] of Object.entries(formulas)) {
    it(modo, () => {
      const { px } = render(folha([solida(A), solida(B, 0, 0, 10, 10, { blendMode: modo as never })]))
      const esperado = a.map((x, i) => Math.round(f(x, b[i]) * 255))
      expect(px(5, 5).slice(0, 3)).toSatisfy((v: number[]) => perto(v, esperado))
    })
  }
  it('normal cobre', () => {
    const { px } = render(folha([solida(A), solida(B)]))
    expect(px(5, 5)).toEqual([...hex(B), 255])
  })
})

describe('opacidade × preenchimento', () => {
  it('alpha efetivo = opacidade × preenchimento', () => {
    const { px } = render(folha([solida('#000000', 0, 0, 10, 10, { opacity: 0.5, fill: 0.5 })]))
    expect(px(5, 5)).toSatisfy((v: number[]) => perto(v, [191, 191, 191, 255]))   // 25% de preto sobre branco
  })
  it('camada oculta não desenha', () => {
    const { px } = render(folha([solida('#000000', 0, 0, 10, 10, { visible: false })]))
    expect(px(5, 5)).toEqual([255, 255, 255, 255])
  })
  it('fundo transparente (PNG com alpha)', () => {
    const { px } = render(folha([solida('#000000', 0, 0, 5, 10)]), 1, null)
    expect(px(8, 5)).toEqual([0, 0, 0, 0])
  })
})

describe('máscara de recorte', () => {
  it('a recortada só aparece dentro da base', () => {
    const { px } = render(folha([solida('#ff0000', 2, 2, 4, 4), solida('#0000ff', 0, 0, 10, 10, { clip: true })]))
    expect(px(3, 3)).toEqual([0, 0, 255, 255])      // dentro da base: azul
    expect(px(8, 8)).toEqual([255, 255, 255, 255])  // fora: papel
  })
  it('base oculta esconde o grupo de recorte', () => {
    const { px } = render(folha([solida('#ff0000', 2, 2, 4, 4, { visible: false }), solida('#0000ff', 0, 0, 10, 10, { clip: true })]))
    expect(px(3, 3)).toEqual([255, 255, 255, 255])
  })
  it('recorte na primeira camada vale como camada comum', () => {
    const { px } = render(folha([solida('#0000ff', 0, 0, 10, 10, { clip: true })]))
    expect(px(8, 8)).toEqual([0, 0, 255, 255])
  })
  it('a recortada mescla com a base no modo dela', () => {
    const { px } = render(folha([solida('#808080', 0, 0, 5, 10), solida('#ff0000', 0, 0, 10, 10, { clip: true, blendMode: 'multiply' })]))
    expect(px(2, 5)).toSatisfy((v: number[]) => perto(v, [128, 0, 0, 255]))
    expect(px(8, 5)).toEqual([255, 255, 255, 255])
  })
  it('opacidade da base vale para o grupo inteiro', () => {
    const { px } = render(folha([solida('#000000', 0, 0, 10, 10, { opacity: 0.5 }), solida('#000000', 0, 0, 10, 10, { clip: true })]))
    expect(px(5, 5)).toSatisfy((v: number[]) => perto(v, [128, 128, 128, 255]))
  })
  it('recortada oculta é ignorada', () => {
    const { px } = render(folha([solida('#ff0000', 2, 2, 4, 4), solida('#0000ff', 0, 0, 10, 10, { clip: true, visible: false })]))
    expect(px(3, 3)).toEqual([255, 0, 0, 255])
  })
})

describe('grupos', () => {
  it('grupo oculto esconde os filhos', () => {
    const { px } = render(folha([grupo([solida('#000000')], { visible: false })]))
    expect(px(5, 5)).toEqual([255, 255, 255, 255])
  })
  it('grupo com opacidade é isolado: filhos sobrepostos não somam', () => {
    const { px } = render(folha([grupo([solida('#000000'), solida('#000000')], { opacity: 0.5 })]))
    expect(px(5, 5)).toSatisfy((v: number[]) => perto(v, [128, 128, 128, 255]))
  })
  it('atravessar: filho em multiplicação mescla com o que está abaixo do grupo', () => {
    const { px } = render(folha([solida('#808080'), grupo([solida('#ff0000', 0, 0, 10, 10, { blendMode: 'multiply' })])]))
    expect(px(5, 5)).toSatisfy((v: number[]) => perto(v, [128, 0, 0, 255]))
  })
  it('grupo normal (isolado): a multiplicação NÃO alcança o que está abaixo', () => {
    const { px } = render(folha([solida('#808080'), grupo([solida('#ff0000', 0, 0, 10, 10, { blendMode: 'multiply' })], { passThrough: false })]))
    expect(px(5, 5)).toEqual([255, 0, 0, 255])
  })
})

describe('cache de camadas', () => {
  it('LRU por bytes', () => {
    const descartados: string[] = []
    const c = new CacheCamadas<string>(100, v => descartados.push(v))
    c.set('a', 'A', 40); c.set('b', 'B', 40)
    expect(c.get('a')).toBe('A')          // 'a' vira o mais recente
    c.set('c', 'C', 40)                   // estoura → sai o menos recente ('b')
    expect(c.get('b')).toBeUndefined()
    expect(descartados).toEqual(['B'])
    expect(c.bytes).toBe(80)
  })
  it('a chave muda com tamanho/escala, não com posição/opacidade', () => {
    const k = chaveRaster('abc', 10, 20, 0, 11.811)
    expect(chaveRaster('abc', 10, 20, 0, 11.811)).toBe(k)
    expect(chaveRaster('abc', 10, 21, 0, 11.811)).not.toBe(k)
    expect(chaveRaster('abc', 10, 20, 0, 5)).not.toBe(k)
  })
})

// ── com uma arte REAL do tema de exemplo (docs/mae-exemplos)
const ARQ = join(process.cwd(), 'docs/mae-exemplos/tema-exemplo/ChatGPT Image 25 de set. de 2026, 09_48_09.png')
const REF = join(process.cwd(), 'lib/mae/__tests__/referencias/motor-01.png')

function receitaReal(sha: string): Prancheta {
  const img = (extra: Partial<NoCamada>): NoCamada => ({ ...base, id: `i${n++}`, type: 'image', src: { path: 'Elementos/arte.png', sha256: sha },
    xMm: 10, yMm: 10, wMm: 60, hMm: 60, rotationDeg: 0, ...extra } as NoCamada)
  return PranchetaZ.parse(folha([
    solida('#f6d6e4', 0, 0, 105, 148),
    solida('#ffffff', 15, 70, 75, 60),
    img({ xMm: 10, yMm: 65, wMm: 85, hMm: 85, clip: true }),
    solida('#ffb703', 15, 70, 75, 60, { clip: true, blendMode: 'multiply', opacity: 0.6 }),
    img({ xMm: 20, yMm: 5, wMm: 60, hMm: 60, rotationDeg: 12, opacity: 0.9 }),
    grupo([solida('#219ebc', 0, 100, 105, 48)], { passThrough: false, opacity: 0.8, blendMode: 'overlay' }),
  ], 105, 148))
}

describe('arte real: determinismo e referência', async () => {
  const buf = readFileSync(ARQ)
  const sha = createHash('sha256').update(buf).digest('hex')
  const imagem = await loadImage(buf)
  const pxPorMm = 4   // ≈ 100 dpi: rápido e ainda detalhado

  const gerar = (cache?: CacheCamadas<CanvasLike>) => {
    const p = receitaReal(sha)
    const { w, h } = tamanhoDoCanvas(p, pxPorMm)
    const c = createCanvas(w, h)
    const r = renderizarPrancheta(c as unknown as CanvasLike, p,
      { pxPorMm, fundo: '#ffffff', criarCanvas: criar, bitmap: s => (s === sha ? imagem as unknown as CanvasImageSource : undefined), cache })
    return { r, png: c.toBuffer('image/png'), rgba: c.getContext('2d').getImageData(0, 0, w, h).data, w, h }
  }

  it('renderizar 2x dá os MESMOS pixels (e o mesmo PNG)', () => {
    const a = gerar(), b = gerar()
    expect(Buffer.compare(Buffer.from(a.rgba), Buffer.from(b.rgba))).toBe(0)
    expect(createHash('sha256').update(a.png).digest('hex')).toBe(createHash('sha256').update(b.png).digest('hex'))
    expect(a.r.faltando).toEqual([])
  })

  it('o cache não muda o resultado e é reaproveitado', () => {
    const cache = new CacheCamadas<CanvasLike>()
    const sem = gerar(), com1 = gerar(cache), com2 = gerar(cache)
    expect(pixelmatch(sem.rgba, com1.rgba, undefined, sem.w, sem.h, { threshold: 0 })).toBe(0)
    expect(Buffer.compare(Buffer.from(com1.rgba), Buffer.from(com2.rgba))).toBe(0)
    expect(cache.acertos).toBeGreaterThan(0)
  })

  it('bate com a imagem de referência (pixelmatch)', () => {
    const atual = gerar()
    if (!existsSync(REF)) writeFileSync(REF, atual.png)   // 1ª execução grava a referência (conferida a olho e commitada)
    const ref = PNG.sync.read(readFileSync(REF))
    expect([ref.width, ref.height]).toEqual([atual.w, atual.h])
    const diff = pixelmatch(ref.data, atual.rgba, undefined, atual.w, atual.h, { threshold: 0.05 })
    expect(diff / (atual.w * atual.h)).toBeLessThan(0.001)
  })

  it('arquivo que falta é avisado, não quebra', () => {
    const { r } = render(receitaReal('ffff0000'))
    expect(r.faltando).toEqual(['ffff0000'])
  })
})
