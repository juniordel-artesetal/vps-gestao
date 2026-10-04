// Sprint 8 — ESTILOS DE CAMADA no motor e PRESETS: cada efeito desenha onde deve (pixels), preenchimento ×
// opacidade, determinismo, e o preset guarda só os efeitos (nunca a fonte).
import { describe, it, expect } from 'vitest'
import { createCanvas, Path2D as P2D } from '@napi-rs/canvas'
import { renderizarPrancheta, tamanhoDoCanvas, type CanvasLike } from '@/lib/mae/render'
import { caixaMm, folgaMm } from '@/lib/mae/render/efeitos'
import { Efeito, efeitoPadrao, limparEfeitos, NOMES_EFEITO, type NoCamada } from '@/lib/mae/schema'
import { PRESETS_NATY, Preset, presetDeEfeitos, efeitosDoPreset } from '@/lib/mae/efeitos/presets'

const K = 4
const base = { visible: true, locked: false, opacity: 1, fill: 1, blendMode: 'normal' as const, clip: false }
/** Quadrado de 20 mm em (20, 20) como CAMINHO (texto) ou como cor sólida. */
const quadrado = (efs: unknown[], tipo: 'path' | 'solid' = 'path', extra: Partial<NoCamada> = {}): NoCamada =>
  (tipo === 'path'
    ? { ...base, id: 'q', name: 'q', type: 'path', d: 'M20 20L40 20L40 40L20 40Z', color: '#000000', bboxMm: [20, 20, 40, 40], effects: limparEfeitos(efs), ...extra }
    : { ...base, id: 'q', name: 'q', type: 'solid', color: '#000000', xMm: 20, yMm: 20, wMm: 20, hMm: 20, effects: limparEfeitos(efs), ...extra }) as NoCamada
function render(no: NoCamada, fundo = '#ffffff') {
  const p = { id: 'p', widthMm: 60, heightMm: 60, layers: [no] }
  const { w, h } = tamanhoDoCanvas(p, K)
  const c = createCanvas(w, h)
  renderizarPrancheta(c as unknown as CanvasLike, p, { pxPorMm: K, fundo, criarCanvas: (a, b) => createCanvas(a, b) as unknown as CanvasLike, bitmap: () => undefined, criarCaminho: d => new P2D(d) as unknown as Path2D })
  const g = c.getContext('2d')
  return { px: (xMm: number, yMm: number) => Array.from(g.getImageData(Math.floor(xMm * K), Math.floor(yMm * K), 1, 1).data).slice(0, 3), dados: Buffer.from(g.getImageData(0, 0, w, h).data) }
}
const perto = (a: number[], b: number[], tol = 12) => a.every((v, i) => Math.abs(v - b[i]) <= tol)

describe('estilos de camada no motor', () => {
  it('traçado de FORA (exato no caminho): pinta só fora, até a largura', () => {
    const r = render(quadrado([{ type: 'stroke', sizeMm: 2, color: '#ff0000', position: 'outside' }]))
    expect(r.px(30, 30)).toEqual([0, 0, 0])           // conteúdo
    expect(perto(r.px(41, 30), [255, 0, 0])).toBe(true) // 1 mm fora: traço
    expect(r.px(43, 30)).toEqual([255, 255, 255])     // 3 mm fora: papel
  })
  it('traçado de DENTRO e no CENTRO', () => {
    const d = render(quadrado([{ type: 'stroke', sizeMm: 2, color: '#ff0000', position: 'inside' }]))
    expect(perto(d.px(21, 30), [255, 0, 0])).toBe(true); expect(d.px(41, 30)).toEqual([255, 255, 255])
    const c = render(quadrado([{ type: 'stroke', sizeMm: 2, color: '#ff0000', position: 'center' }]))
    expect(perto(c.px(40.5, 30), [255, 0, 0])).toBe(true); expect(perto(c.px(39.5, 30), [255, 0, 0])).toBe(true)
  })
  it('vários traçados empilhados (o de baixo maior aparece por fora)', () => {
    const r = render(quadrado([{ type: 'stroke', sizeMm: 3, color: '#0000ff' }, { type: 'stroke', sizeMm: 1.5, color: '#ffffff' }]))
    expect(perto(r.px(40.7, 30), [255, 255, 255])).toBe(true)
    expect(perto(r.px(42.3, 30), [0, 0, 255])).toBe(true)
  })
  it('traçado em imagem/cor sólida (por dilatação) também funciona', () => {
    const r = render(quadrado([{ type: 'stroke', sizeMm: 2, color: '#ff0000' }], 'solid'))
    expect(perto(r.px(41, 30), [255, 0, 0], 40)).toBe(true)
  })
  it('sombra projetada vai para baixo/direita com o ângulo 120°', () => {
    const r = render(quadrado([{ type: 'dropShadow', color: '#000000', opacity: 1, angleDeg: 120, distanceMm: 3, sizeMm: 0.1 }]))
    expect(r.px(41, 41)[0]).toBeLessThan(80)          // canto de baixo/direita: sombra
    expect(r.px(19, 19)).toEqual([255, 255, 255])     // canto de cima/esquerda: nada
  })
  it('sobreposição de cor e de degradê; preenchimento 0 mantém os efeitos', () => {
    expect(perto(render(quadrado([{ type: 'colorOverlay', color: '#00ff00' }])).px(30, 30), [0, 255, 0])).toBe(true)
    const g = render(quadrado([{ type: 'gradientOverlay', stops: [{ pos: 0, color: '#ff0000' }, { pos: 1, color: '#0000ff' }], angleDeg: 90 }]))
    expect(g.px(30, 21)[2]).toBeGreaterThan(g.px(30, 21)[0])   // 90° = de baixo (vermelho) para cima (azul)
    expect(g.px(30, 39)[0]).toBeGreaterThan(g.px(30, 39)[2])
    const f0 = render(quadrado([{ type: 'colorOverlay', color: '#00ff00' }], 'path', { fill: 0 }))
    expect(perto(f0.px(30, 30), [0, 255, 0])).toBe(true)
    const op = render(quadrado([{ type: 'colorOverlay', color: '#000000' }], 'path', { opacity: 0.5 }))
    expect(perto(op.px(30, 30), [128, 128, 128])).toBe(true)
  })
  it('brilho externo, brilho interno, sombra interna e chanfro desenham onde devem', () => {
    const ge = render(quadrado([{ type: 'outerGlow', color: '#ff0000', opacity: 1, sizeMm: 2, spread: 0.5 }]))
    expect(ge.px(40.5, 30)[1]).toBeLessThan(200)      // fora, perto: avermelhado
    const gi = render(quadrado([{ type: 'innerGlow', color: '#ffffff', opacity: 1, sizeMm: 2 }]))
    expect(gi.px(20.3, 30)[0]).toBeGreaterThan(gi.px(30, 30)[0])   // borda clareia, meio não
    const si = render(quadrado([{ type: 'colorOverlay', color: '#ffffff' }, { type: 'innerShadow', color: '#000000', opacity: 1, angleDeg: 120, distanceMm: 2, sizeMm: 0.2 }]))
    expect(si.px(21, 30)[0]).toBeLessThan(si.px(38, 30)[0])         // sombra entra pela esquerda/topo
    const ch = render(quadrado([{ type: 'colorOverlay', color: '#808080' }, { type: 'bevel', sizeMm: 1.5, depth: 2 }]))
    expect(ch.px(20.4, 30)[0]).not.toBe(ch.px(39.6, 30)[0])         // realce de um lado, sombra do outro
  })
  it('determinístico: 2 renders = mesmos pixels', () => {
    const efs = PRESETS_NATY[4].effects
    expect(Buffer.compare(render(quadrado(efs)).dados, render(quadrado(efs)).dados)).toBe(0)
  })
  it('caixa e folga dos efeitos', () => {
    expect(caixaMm(quadrado([]))).toEqual([20, 20, 40, 40])
    expect(folgaMm(limparEfeitos([{ type: 'dropShadow', color: '#000000', distanceMm: 2, sizeMm: 1 }]))).toBeCloseTo(4.5)
  })
  it('todos os tipos têm nome em português e padrão válido', () => {
    for (const t of Object.keys(NOMES_EFEITO) as (keyof typeof NOMES_EFEITO)[]) expect(Efeito.safeParse(efeitoPadrao(t)).success).toBe(true)
  })
})

describe('presets de efeito', () => {
  it('guarda SÓ os efeitos — nunca a fonte (nem outros campos)', () => {
    const p = presetDeEfeitos('Rosa', [{ type: 'stroke', sizeMm: 1, color: '#ffffff', font: 'Pacifico' }, { postscriptName: 'Pacifico' }, 'lixo'])
    expect(p.effects.length).toBe(1)
    expect(JSON.stringify(p)).not.toMatch(/Pacifico|postscript|font/i)
  })
  it('aplicar = cópia profunda editável (não mexe no preset)', () => {
    const c = efeitosDoPreset(PRESETS_NATY[0])
    ;(c[1] as { sizeMm: number }).sizeMm = 9
    expect((PRESETS_NATY[0].effects[1] as { sizeMm: number }).sizeMm).not.toBe(9)
  })
  it('os 5 estilos de nome da Loja da Naty são válidos e grátis', () => {
    expect(PRESETS_NATY.length).toBe(5)
    for (const p of PRESETS_NATY) { expect(Preset.safeParse(p).success).toBe(true); expect(p.effects.length).toBeGreaterThanOrEqual(3); expect(p.owner).toBe('naty') }
  })
})
