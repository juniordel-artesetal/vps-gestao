// Lote 15 (item 202): a marca de registro com AJUSTE FINO e a CALIBRAÇÃO por um PDF que corta certo.
import { describe, it, expect } from 'vitest'
import { marcaNaFolha, ajusteNaFolha, zonasNaFolha, cantosDasMarcas, cantosNaFolha, deslocamentoDasMarcas } from '@/lib/mae/exportar/marca'

/** Página W × H (mm) com os "L" das marcas nos 4 cantos, a `ins` mm das bordas (+ deslocamento). */
function pagina(W: number, H: number, ins: { e: number; t: number; d: number; b: number }, k = 10) {
  const w = Math.round(W * k), h = Math.round(H * k), rgba = new Uint8ClampedArray(w * h * 4).fill(255)
  const pinta = (x0: number, y0: number, x1: number, y1: number) => { for (let y = Math.round(y0 * k); y < Math.round(y1 * k); y++) for (let x = Math.round(x0 * k); x < Math.round(x1 * k); x++) { const i = (y * w + x) * 4; rgba[i] = rgba[i + 1] = rgba[i + 2] = 0 } }
  const L = 10, g = 0.5
  pinta(ins.e, ins.t, ins.e + L, ins.t + g); pinta(ins.e, ins.t, ins.e + g, ins.t + L)                       // cima/esq
  pinta(W - ins.d - L, ins.t, W - ins.d, ins.t + g); pinta(W - ins.d - g, ins.t, W - ins.d, ins.t + L)       // cima/dir
  pinta(ins.e, H - ins.b - g, ins.e + L, H - ins.b); pinta(ins.e, H - ins.b - L, ins.e + g, H - ins.b)       // baixo/esq
  pinta(W - ins.d - L, H - ins.b - g, W - ins.d, H - ins.b); pinta(W - ins.d - g, H - ins.b - L, W - ins.d, H - ins.b)
  return { rgba, w, h }
}

describe('202 — ajuste fino da marca', () => {
  it('sem ajuste: igual a antes (1:1, girada para a prancheta deitada)', () => {
    expect(marcaNaFolha(297, 210, 210, 297)).toEqual({ girar: true, diferente: false, dx: 0, dy: 0 })
  })
  it('o ajuste anda a marca na folha; medido deitado e usado em pé, o vetor gira junto', () => {
    const aj = { xMm: 3.15, yMm: 0.03, paisagem: true }
    expect(marcaNaFolha(297, 210, 210, 297, 0.6, aj)).toMatchObject({ girar: true, dx: 3.15, dy: 0.03 })
    expect(ajusteNaFolha(aj, 210, 297)).toEqual({ x: 0.03, y: -3.15 })
    expect(ajusteNaFolha({ xMm: 0.03, yMm: -3.15, paisagem: false }, 297, 210)).toEqual({ x: 3.15, y: 0.03 })
  })
  it('as zonas (fundo branco atrás da marca) andam junto', () => {
    const z = zonasNaFolha([{ x: 10, y: 10, w: 5, h: 5 }], marcaNaFolha(297, 210, 210, 297, 0.6, { xMm: 3, yMm: 0, paisagem: true }), 297)
    const z0 = zonasNaFolha([{ x: 10, y: 10, w: 5, h: 5 }], marcaNaFolha(297, 210, 210, 297), 297)
    expect(z[0].x - z0[0].x).toBeCloseTo(3); expect(z[0].y).toBeCloseTo(z0[0].y)
  })
})

describe('202 — calibrar por um PDF que corta certo', () => {
  it('a marca da Naty (A4 em pé, 9,8 mm simétrica) × a da Helena (deitada, deslocada +3,15): mede +3,15 / 0', () => {
    const marca = pagina(210, 297, { e: 9.8, t: 9.8, d: 9.8, b: 9.8 })
    const helena = pagina(297, 210, { e: 12.95, t: 9.8, d: 9.8 - 3.15, b: 9.8 })
    const e = marcaNaFolha(297, 210, 210, 297)
    const nosso = cantosNaFolha(cantosDasMarcas(marca.rgba, marca.w, marca.h, 10), e, 297, 297, 210)
    const d = deslocamentoDasMarcas(nosso, cantosDasMarcas(helena.rgba, helena.w, helena.h, 10))
    expect('erro' in d).toBe(false)
    if (!('erro' in d)) { expect(Math.abs(d.xMm - 3.15)).toBeLessThan(0.11); expect(Math.abs(d.yMm)).toBeLessThan(0.11) }   // o grão do raster (0,1 mm) — o aceite pede < 0,2 mm
  })
  it('cantos que não andam juntos (outra escala / outra marca) → aviso, não chuta', () => {
    const a = pagina(297, 210, { e: 9.8, t: 9.8, d: 9.8, b: 9.8 }), b = pagina(297, 210, { e: 12, t: 9.8, d: 12, b: 9.8 })
    const d = deslocamentoDasMarcas(cantosDasMarcas(a.rgba, a.w, a.h, 10), cantosDasMarcas(b.rgba, b.w, b.h, 10))
    expect('erro' in d && /não andam juntos/.test(d.erro)).toBe(true)
  })
})
