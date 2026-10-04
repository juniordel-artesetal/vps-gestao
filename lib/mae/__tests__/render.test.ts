import { describe, expect, it } from 'vitest'
import { tamanhoEmPx, mmParaPx, pxParaMm, DPI_EXPORTACAO, ajustar, tamanhoReal, zoomNoPonto, telaParaMm, mmParaTela,
  calibracaoDoCartao, CARTAO_MM, zoomPercentual, desenharPrancheta, passoDaGrade } from '@/lib/mae/render'

const A4 = { xMm: 0, yMm: 0, wMm: 210, hMm: 297 }

describe('mae-render · unidades', () => {
  it('A4 a 300 dpi = 2480 × 3508 px (tamanho de exportação)', () => {
    expect(tamanhoEmPx(210, 297, DPI_EXPORTACAO)).toEqual({ w: 2480, h: 3508 })
  })
  it('mm ↔ px é ida e volta exata', () => {
    expect(pxParaMm(mmParaPx(123.4, 300), 300)).toBeCloseTo(123.4, 10)
    expect(mmParaPx(25.4, 96)).toBeCloseTo(96, 10)
  })
})

describe('mae-render · viewport', () => {
  it('"Ajustar" faz a A4 inteira caber na tela, centralizada', () => {
    const v = ajustar(A4, 1200, 800, 32)
    const tl = mmParaTela(v, 0, 0), br = mmParaTela(v, 210, 297)
    expect(tl.y).toBeGreaterThanOrEqual(32 - 1e-9); expect(br.y).toBeLessThanOrEqual(800 - 32 + 1e-9)
    expect(tl.x).toBeGreaterThanOrEqual(0); expect(br.x).toBeLessThanOrEqual(1200)
    expect((tl.x + br.x) / 2).toBeCloseTo(600, 6)
  })
  it('"Tamanho real" com calibração: 100 mm viram exatamente 100 mm físicos na tela', () => {
    const calib = calibracaoDoCartao(330)          // o cartão de 85,6 mm ocupou 330 px CSS nesta tela
    const v = tamanhoReal(A4, 1200, 800, calib)
    const pxDe100mm = mmParaTela(v, 100, 0).x - mmParaTela(v, 0, 0).x
    expect(pxDe100mm / calib).toBeCloseTo(100, 9)   // px ÷ (px por mm físico) = mm físicos
    expect(pxDe100mm).toBeCloseTo(100 * 330 / CARTAO_MM, 9)
    expect(zoomPercentual(v, calib)).toBe(100)
  })
  it('zoom no ponto mantém o mm debaixo do cursor no mesmo lugar', () => {
    const v = ajustar(A4, 1200, 800)
    const antes = telaParaMm(v, 700, 300)
    const depois = telaParaMm(zoomNoPonto(v, 2.5, 700, 300), 700, 300)
    expect(depois.xMm).toBeCloseTo(antes.xMm, 9); expect(depois.yMm).toBeCloseTo(antes.yMm, 9)
  })
  it('passo da grade acompanha o zoom (linhas a ≥ 8 px)', () => {
    expect(passoDaGrade(10)).toBe(1); expect(passoDaGrade(2)).toBe(5); expect(passoDaGrade(0.3)).toBe(50)
  })
})

describe('mae-render · desenharPrancheta (motor único)', () => {
  it('pinta a folha em mm e respeita grade/borda desligadas (caminho da exportação)', () => {
    const chamadas: string[] = []
    const ctx = new Proxy({}, {
      get: (_t, prop) => (prop === 'save' || prop === 'restore' || typeof prop !== 'string') ? () => chamadas.push(String(prop)) : (...a: unknown[]) => chamadas.push(`${prop}(${a.join(',')})`),
      set: (_t, prop, val) => { chamadas.push(`${String(prop)}=${val}`); return true },
    }) as unknown as CanvasRenderingContext2D
    desenharPrancheta(ctx, { widthMm: 210, heightMm: 297 }, { pxPorMmDoDispositivo: mmParaPx(1, 300), grade: false, borda: false })
    expect(chamadas).toContain('fillRect(0,0,210,297)')
    expect(chamadas.some(c => c.startsWith('stroke'))).toBe(false)
  })
})
