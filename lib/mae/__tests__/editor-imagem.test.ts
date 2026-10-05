// Sprint 13 — EDITOR DE IMAGEM UNIFICADO (funções do SOA Design no motor do MAE): texto livre (parágrafos e
// quebra na caixa), formas livres (inclusive seta), camada de AJUSTE (vale para o que está abaixo; recortada
// = só a camada de baixo), espelhar e máscara em imagem de caixa (a máscara anda com a caixa).
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createCanvas, Path2D as P2D } from '@napi-rs/canvas'
import { abrirFonte, type FonteHB } from '@/lib/mae/texto/fonte'
import { quebrarLinhas, diagramarLivre, aplicarCaixa } from '@/lib/mae/texto/livre'
import { materializar, textoEmCaminho, formaEmCaminho } from '@/lib/mae/editor/materializar'
import { novoTexto, novaFormaLivre, novoAjuste, novaImagem, novaSolida } from '@/lib/mae/editor/camadas'
import { renderizarPrancheta, tamanhoDoCanvas, type CanvasLike } from '@/lib/mae/render'
import { Ajuste } from '@/lib/mae/schema/edicao'
import { NoCamadaZ, type NoCamada } from '@/lib/mae/schema'

let fonte: FonteHB
const fontes = () => ({ obter: () => undefined, substituta: fonte })
beforeAll(async () => { fonte = await abrirFonte(readFileSync(join(process.cwd(), 'public/mae/fontes/Sniglet-Regular.ttf'))) })

function desenhar(layers: NoCamada[], bitmaps: Record<string, unknown> = {}, w = 100, h = 60, k = 4) {
  const p = { id: 'p', widthMm: w, heightMm: h, layers: materializar(layers, fontes()) }
  const t = tamanhoDoCanvas(p, k), c = createCanvas(t.w, t.h)
  renderizarPrancheta(c as unknown as CanvasLike, p, { pxPorMm: k, fundo: '#ffffff', criarCanvas: (a, b) => createCanvas(a, b) as unknown as CanvasLike, bitmap: s => bitmaps[s] as CanvasImageSource, criarCaminho: d => new P2D(d) as unknown as Path2D })
  const g = c.getContext('2d')
  return (x: number, y: number) => Array.from(g.getImageData(Math.floor(x * k), Math.floor(y * k), 1, 1).data).slice(0, 3)
}

describe('texto livre', () => {
  it('quebra na largura da caixa e respeita Enter; maiúsculas/título', () => {
    const l = quebrarLinhas(fonte, 'Feliz aniversário Maria Júlia\nObrigado!', { tamanhoPt: 24 }, 40)
    expect(l.length).toBeGreaterThanOrEqual(3); expect(l.at(-1)).toBe('Obrigado!')
    expect(aplicarCaixa('maria júlia', 'titulo')).toBe('Maria Júlia')
    expect(aplicarCaixa('Maria', 'alta')).toBe('MARIA')
    const d = diagramarLivre(fonte, 'Oi', { tamanhoPt: 24 }, 50)
    expect(d.cmds.length).toBeGreaterThan(5); expect(d.hMm).toBeGreaterThan(5)
  })
  it('texto vira caminho dentro da caixa, centrado; girar 90° gira o caminho', () => {
    const t = { ...novoTexto({ xMm: 10, yMm: 10, wMm: 80, hMm: 40, valor: 'Sophia' }), tamanhoPt: 40 }
    const r = textoEmCaminho(t, fontes())!
    expect(r.substituta).toBe(true)
    const [x0, y0, w, h] = r.no.bboxMm
    expect(x0).toBeGreaterThan(10); expect(x0 + w).toBeLessThan(90); expect(y0).toBeGreaterThan(10); expect(y0 + h).toBeLessThan(50)
    expect(Math.abs((x0 + w / 2) - 50)).toBeLessThan(2)                 // centrado
    const g = textoEmCaminho({ ...t, rotationDeg: 90 }, fontes())!
    expect(g.no.bboxMm[3]).toBeGreaterThan(g.no.bboxMm[2])               // girado: fica "em pé"
  })
  it('o texto aparece no motor (pixels da cor do texto)', () => {
    const t = { ...novoTexto({ xMm: 0, yMm: 0, wMm: 100, hMm: 60, valor: 'I' }), tamanhoPt: 120, color: '#ff0000' }
    expect(desenhar([t])(50, 30)).toEqual([255, 0, 0])
  })
})

describe('formas livres', () => {
  it('estrela, coração, seta, linha: caminho na caixa; linha só contorno', () => {
    for (const kind of ['rect', 'ellipse', 'polygon', 'star', 'heart', 'arrow'] as const) {
      const f = formaEmCaminho(novaFormaLivre({ kind, xMm: 10, yMm: 10, wMm: 40, hMm: 20 }))!
      expect(f.bboxMm[0]).toBeGreaterThanOrEqual(8); expect(f.bboxMm[0] + f.bboxMm[2]).toBeLessThanOrEqual(52)   // o coração passa ~4% da caixa (curva)
    }
    const l = formaEmCaminho(novaFormaLivre({ kind: 'line', xMm: 0, yMm: 0, wMm: 50, hMm: 2 }))!
    expect(l.fillNone).toBe(true); expect(l.stroke?.widthMm).toBeGreaterThan(0)
  })
  it('retângulo cheio no motor', () => {
    expect(desenhar([{ ...novaFormaLivre({ kind: 'rect', xMm: 20, yMm: 20, wMm: 20, hMm: 10 }), color: '#0000ff' }])(30, 25)).toEqual([0, 0, 255])
  })
})

describe('camada de ajuste', () => {
  const vermelho = () => ({ ...novaSolida({ color: '#ff0000', xMm: 0, yMm: 0, wMm: 100, hMm: 60 }) })
  it('vale para o que está ABAIXO dela; o que está acima não muda', () => {
    const pb = novoAjuste([Ajuste.parse({ type: 'blackWhite' })])
    const azul = novaSolida({ color: '#0000ff', xMm: 60, yMm: 0, wMm: 40, hMm: 60 })
    const px = desenhar([vermelho(), pb, azul])
    const [r, g, b] = px(20, 30); expect(r).toBe(g); expect(g).toBe(b)   // vermelho virou cinza
    expect(px(80, 30)).toEqual([0, 0, 255])                              // o azul (acima) continua azul
  })
  it('opacidade da camada de ajuste e desligar', () => {
    const meio = { ...novoAjuste([Ajuste.parse({ type: 'blackWhite' })]), opacity: 0.5 }
    const [r, g] = desenhar([vermelho(), meio])(20, 30); expect(r).toBeGreaterThan(g)
    expect(desenhar([vermelho(), { ...meio, visible: false }])(20, 30)).toEqual([255, 0, 0])
  })
  it('ajuste RECORTADO vale só para a camada de baixo', () => {
    const fundo = novaSolida({ color: '#00ff00', xMm: 0, yMm: 0, wMm: 100, hMm: 60 })
    const quadrado = novaSolida({ color: '#ff0000', xMm: 0, yMm: 0, wMm: 50, hMm: 60 })
    const pb = { ...novoAjuste([Ajuste.parse({ type: 'blackWhite' })]), clip: true }
    const px = desenhar([fundo, quadrado, pb])
    const [r, g, b] = px(20, 30); expect(r).toBe(g); expect(g).toBe(b)
    expect(px(80, 30)).toEqual([0, 255, 0])                              // o fundo verde não foi afetado
  })
  it('valida no schema (texto, forma, ajuste)', () => {
    for (const n of [novoTexto({ xMm: 0, yMm: 0, wMm: 10, hMm: 5 }), novaFormaLivre({ kind: 'arrow', xMm: 0, yMm: 0, wMm: 10, hMm: 5 }), novoAjuste([Ajuste.parse({ type: 'levels' })])])
      expect(NoCamadaZ.safeParse(n).success).toBe(true)
  })
})

describe('imagem de caixa: espelhar e máscara que anda com a caixa', () => {
  const metade = () => { const c = createCanvas(20, 10); const g = c.getContext('2d'); g.fillStyle = '#ff0000'; g.fillRect(0, 0, 10, 10); g.fillStyle = '#0000ff'; g.fillRect(10, 0, 10, 10); return c }
  it('espelhar ↔ troca os lados', () => {
    const im = novaImagem({ path: 'x.png', sha256: 'xxxx', xMm: 0, yMm: 0, wMm: 100, hMm: 60 })
    const px = desenhar([{ ...im, flipX: true }], { xxxx: metade() })
    expect(px(10, 30)).toEqual([0, 0, 255]); expect(px(90, 30)).toEqual([255, 0, 0])
  })
  it('máscara em degradê no quadrado da imagem acompanha a caixa movida', () => {
    const im = { ...novaImagem({ path: 'x.png', sha256: 'xxxx', xMm: 40, yMm: 0, wMm: 60, hMm: 60 }),
      mask: { enabled: true, invert: false, featherMm: 0, gradient: { type: 'linear' as const, x0: 0.5, y0: 0, x1: 0.5001, y1: 0, stops: [{ pos: 0, alpha: 0 }, { pos: 1, alpha: 1 }], matrix: [1, 0, 0, 1, 0, 0] as [number, number, number, number, number, number] } } }
    const px = desenhar([im], { xxxx: metade() })
    expect(px(45, 30)).toEqual([255, 255, 255])   // metade esquerda da IMAGEM some (fundo branco)
    expect(px(90, 30)).toEqual([0, 0, 255])       // a direita aparece
  })
})
