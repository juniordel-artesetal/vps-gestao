// Lote 21 (item 254): paleta do tema — as cores principais dos papéis/elementos, com o tom claro e o escuro.
import { describe, it, expect } from 'vitest'
import { paletaDePixels, imagensDoTema } from '@/lib/mae/vinculo/paletaDoTema'

const pixels = (partes: [number, number, number, number][]) => {
  const out: number[] = []
  for (const [r, g, b, n] of partes) for (let i = 0; i < n; i++) out.push(r, g, b)
  return out
}

describe('paletaDePixels', () => {
  it('acha as cores principais, da que mais aparece para a que menos aparece', () => {
    const p = paletaDePixels(pixels([[240, 120, 160, 600], [60, 140, 220, 300], [250, 220, 90, 100]]))
    expect(p.slice(0, 3).map(c => c.cor)).toEqual(['#f078a0', '#3c8cdc', '#fadc5a'])
    expect(p[0].peso).toBeGreaterThan(p[1].peso)
  })
  it('cada cor vem com um tom mais claro e um mais escuro', () => {
    const [c] = paletaDePixels(pixels([[200, 100, 50, 100]]))
    const lum = (h: string) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16)
    expect(lum(c.clara)).toBeGreaterThan(lum(c.cor))
    expect(lum(c.escura)).toBeLessThan(lum(c.cor))
  })
  it('tons quase iguais viram uma cor só; no máximo 8', () => {
    const p = paletaDePixels(pixels([[240, 120, 160, 300], [244, 124, 158, 300]]))
    expect(p.length).toBe(1)
    const muitas = paletaDePixels(pixels(Array.from({ length: 14 }, (_, i) => [i * 18, 255 - i * 18, (i * 70) % 255, 50] as [number, number, number, number])))
    expect(muitas.length).toBeLessThanOrEqual(8)
    expect(muitas.length).toBeGreaterThanOrEqual(5)
  })
  it('sem pixels: paleta vazia; o mesmo resultado sempre', () => {
    expect(paletaDePixels([])).toEqual([])
    const px = pixels([[10, 200, 30, 500], [200, 30, 200, 500], [90, 90, 90, 200]])
    expect(paletaDePixels(px)).toEqual(paletaDePixels(px))
  })
})

describe('imagensDoTema', () => {
  it('papéis, elementos e páginas do tema pronto — sem marcas/moldes, sem repetir', () => {
    const t = {
      partContent: { a: [{ source: { path: 'Papéis/Ursinhos/poa.png' } }, { source: { path: 'Elementos/laco.png' } }], b: [{ source: { path: 'Papéis/Ursinhos/poa.png' } }] },
      faceContent: { f: [{ source: { path: 'Temas/paginas/X/pg1.jpg' } }] },
      registro: { path: 'Marcas/mr.png' }, fonte: { path: 'Fontes/a.ttf' },
    }
    expect(imagensDoTema(t)).toEqual(['Papéis/Ursinhos/poa.png', 'Elementos/laco.png', 'Temas/paginas/X/pg1.jpg'])
  })
})
