// Lote 10 — primeira arte real (13/10/2026): ordem da caixa entre listas e com textos (151), capacidade dos atalhos
// por tipo de objeto (153) e o motivo das falhas de sincronia (150). Telas em fabtest/ui_mae_menus.mts.
import { describe, it, expect, vi } from 'vitest'
vi.setConfig({ testTimeout: 30000 })
import { aplicarOrdem, ordemDaCaixa, moverNaOrdem, idTexto } from '@/lib/mae/vinculo/ordem'
import { novoDocumento } from '@/lib/mae/schema/documento'
import { montarBaseDeMedidas } from '@/lib/mae/medidas/pecas'
import { novoTema } from '@/lib/mae/vinculo/tema'
import { pilhaDaFace, reordenarNaFace, idsNaOrdem } from '@/lib/mae/vinculo/pilha'
import { resolverPrancheta } from '@/lib/mae/vinculo/resolver'
import { ATALHOS, CAPACIDADE, TIPOS_OBJETO, vale, avisoNaoVale } from '@/lib/mae/editor/atalhos'
import type { DocTema, NoCamada } from '@/lib/mae/schema'

describe('151 — ordem da caixa (regra pura)', () => {
  it('sem ordem guardada: nada muda', () => {
    expect(aplicarOrdem(['a', 'b', 'c'], x => x, undefined)).toEqual(['a', 'b', 'c'])
  })
  it('a ordem guardada manda; item novo fica logo acima do vizinho de baixo', () => {
    expect(aplicarOrdem(['papel', 'el', 'novo'], x => x, ['el', 'papel'])).toEqual(['el', 'papel', 'novo'])
    expect(aplicarOrdem(['papel', 'novo', 'el'], x => x, ['el', 'papel'])).toEqual(['el', 'papel', 'novo'])
  })
  it('camada posta acima de um texto sobe para cima dos textos da caixa', () => {
    const r = ordemDaCaixa(['papel', 'el'], ['s1'], ['papel', idTexto('s1'), 'el'])
    expect([...r.acimaDosTextos]).toEqual(['el'])
  })
  it('mover: frente / trás / topo / fundo / índice; nada a fazer → null', () => {
    expect(moverNaOrdem(['a', 'b', 'c'], 'a', 'frente')).toEqual(['b', 'a', 'c'])
    expect(moverNaOrdem(['a', 'b', 'c'], 'a', 'topo')).toEqual(['b', 'c', 'a'])
    expect(moverNaOrdem(['a', 'b', 'c'], 'c', 'fundo')).toEqual(['c', 'a', 'b'])
    expect(moverNaOrdem(['a', 'b', 'c'], 'c', 'frente')).toBeNull()
    expect(moverNaOrdem(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c'])
  })
})

/** Base de 1 molde com 2 faces (partes P e Q) e um tema com papel da parte + elemento SÓ DESTA CAIXA (o caso do TRANSFORMERS). */
function caso() {
  const d = novoDocumento('A4')
  montarBaseDeMedidas(d, [{ nome: 'Caixa', medida: { forma: 'retangulo', larguraMm: 60, alturaMm: 40 } }])
  const m = d.molds[0], f = m.faces[0]
  d.parts = [{ id: 'p', name: 'FRENTE', referenceAspect: 1.5, instances: [{ faceId: f.id, moldeId: m.id, fit: { mode: 'cover' } }] }] as never
  d.textSlots = [{ id: 's1', variable: 'NOME', faceId: f.id, box: { x: 0.1, y: 0.4, w: 0.8, h: 0.2 }, single: { lines: 1, sizePt: 20 }, compound: { lines: 2, sizePt: 16, lineHeight: 0.9 }, autoFit: { minScale: 0.7 } }] as never
  const t = novoTema({ nome: 'T', baseId: d.id, baseVersion: 1 }) as DocTema
  t.partContent.p = [{ id: 'papel', type: 'solid', anchor: 'paper', color: '#00ff00' }] as never
  t.faceContent = { [f.id]: [{ id: 'el', type: 'image', anchor: 'face', path: 'Elementos/e.png', sha256: 'e', aspect: 1, transform: { x: 0.5, y: 0.5, scale: 0.3, rotationDeg: 0 } }] } as never
  return { d, t, f, ab: d.artboards[0].id }
}
const ids = (ns: NoCamada[]): string[] => ns.flatMap(n => (n.type === 'group' ? ids((n as { children: NoCamada[] }).children) : [n.id]))

describe('151 — ordem entre a lista da PARTE e a SÓ DESTA CAIXA, e com textos', () => {
  it('elemento sozinho no conteúdo da caixa vai para baixo do papel da parte (antes: nada acontecia)', () => {
    const { d, t, f } = caso()
    expect(pilhaDaFace(d, t, f.id).map(x => x.id)).toEqual(['s1', 'el', 'papel'])    // de cima para baixo
    expect(reordenarNaFace(d, t, f.id, 'el', 'tras')).toBe(true)
    expect(pilhaDaFace(d, t, f.id).map(x => x.id)).toEqual(['s1', 'papel', 'el'])
    expect(t.ordemFace?.[f.id]).toEqual(['el', 'papel', 't:s1'])
  })
  it('o resolvedor desenha na MESMA ordem (tela e arquivo)', () => {
    const { d, t, f, ab } = caso()
    reordenarNaFace(d, t, f.id, 'el', 'tras')
    const ordem = ids(resolverPrancheta(d, ab, { tema: t })).filter(x => /:(x:)?(el|papel)$/.test(x))
    expect(ordem[0]).toMatch(/:x:el$/)
    expect(ordem[1]).toMatch(/:papel$/)
  })
  it('elemento por cima do texto: sai DEPOIS dos textos, recortado na face', () => {
    const { d, t, f, ab } = caso()
    expect(reordenarNaFace(d, t, f.id, 'el', 'topo')).toBe(true)
    expect(pilhaDaFace(d, t, f.id).map(x => x.id)).toEqual(['el', 's1', 'papel'])
    const textos = { fontes: { obter: () => undefined, substituta: undefined as never }, valores: {} }
    const nos = resolverPrancheta(d, ab, { tema: t, texto: textos as never })
    const i = nos.findIndex(n => n.id.endsWith(':sobreTextos'))
    expect(i).toBeGreaterThanOrEqual(0)
    expect((nos[i] as { clipOnly?: boolean }).clipOnly).toBe(true)
    expect(nos[i + 1].id).toMatch(/:x:el$/)
  })
  it('texto também se move (vai para baixo do elemento)', () => {
    const { d, t, f } = caso()
    expect(idsNaOrdem(d, t, f.id).ids).toEqual(['papel', 'el', 't:s1'])
    expect(reordenarNaFace(d, t, f.id, 't:s1', 'tras')).toBe(true)
    expect(pilhaDaFace(d, t, f.id).map(x => x.id)).toEqual(['el', 's1', 'papel'])
  })
})

describe('153 — nenhum atalho "morto": a tabela de capacidade', () => {
  it('toda ação da tabela existe na lista de atalhos e todo tipo de objeto é conhecido', () => {
    const acoes = new Set(ATALHOS.map(a => a.acao))
    for (const [acao, tipos] of Object.entries(CAPACIDADE)) {
      expect(acoes.has(acao as never) || acao === 'excluir', acao).toBe(true)
      for (const tp of tipos ?? []) expect(TIPOS_OBJETO).toContain(tp)
    }
  })
  it('espelhar não vale para texto/papel/moldurinha; ordem não vale para grupo; cadeado vale para todos', () => {
    expect(vale('espelharH', 'texto')).toBe(false)
    expect(vale('espelharH', 'papel')).toBe(false)
    expect(vale('espelharH', 'elemento')).toBe(true)
    expect(vale('frente', 'grupo')).toBe(false)
    expect(vale('frente', 'texto')).toBe(true)
    for (const tp of TIPOS_OBJETO) expect(vale('cadeado', tp)).toBe(true)
    expect(vale('zoomMais', 'texto')).toBe(true)                 // fora da tabela: sempre
    expect(avisoNaoVale('espelharH', 'texto')).toMatch(/não vale para texto/)
  })
})

describe('150 — o motivo da falha de sincronia, em português', () => {
  it('sessão, permissão, recusa, tamanho e sem conexão', async () => {
    const { motivoDaFalha } = await import('@/components/mae/sincronia')
    expect(motivoDaFalha(401)).toMatch(/sessão expirou/)
    expect(motivoDaFalha(403)).toMatch(/não está liberado/)
    expect(motivoDaFalha(400, 'Marca inválida')).toBe('o servidor recusou: Marca inválida')
    expect(motivoDaFalha(413)).toMatch(/grande demais/)
    expect(motivoDaFalha(null)).toBe('sem conexão com o servidor')
  })
})

// ── P1 ────────────────────────────────────────────────────────────────────────────────────────────────────────────
import { createCanvas, Path2D as P2D } from '@napi-rs/canvas'
;(globalThis as { Path2D?: unknown }).Path2D ??= P2D
import { renderizarPrancheta, type CanvasLike } from '@/lib/mae/render/renderizar'
import { acharApliques, montarFolhas } from '@/lib/mae/apliques/folhas'
import { DocTema as DocTemaZ } from '@/lib/mae/schema'

const criar = (w: number, h: number) => createCanvas(w, h) as unknown as CanvasLike
function pixels(camadas: NoCamada[], k = 4) {
  const c = createCanvas(100 * k, 80 * k)
  renderizarPrancheta(c as unknown as CanvasLike, { id: 'ab', widthMm: 100, heightMm: 80, layers: camadas } as never, { pxPorMm: k, fundo: '#ffffff', criarCanvas: criar, bitmap: () => undefined })
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  return (x: number, y: number) => { const i = (Math.round(y * k) * c.width + Math.round(x * k)) * 4; return [d[i], d[i + 1], d[i + 2]] }
}
const base0 = { visible: true, locked: false, opacity: 1, fill: 1, blendMode: 'normal', clip: false }

describe('155 — máscara de FORMA e recorte com base invisível', () => {
  it('máscara de forma: só a metade esquerda da camada aparece', () => {
    const verde = { ...base0, id: 'v', type: 'solid', color: '#00ff00', xMm: 10, yMm: 10, wMm: 80, hMm: 60,
      mask: { enabled: true, invert: false, featherMm: 0, forma: { aneis: [[[0, 0], [0.5, 0], [0.5, 1], [0, 1]]], matrix: [80, 0, 0, 60, 10, 10] } } } as never
    const px = pixels([verde])
    expect(px(20, 40)).toEqual([0, 255, 0])          // metade esquerda
    expect(px(80, 40)).toEqual([255, 255, 255])      // metade direita escondida
  })
  it('máscara de forma invertida: esconde a seleção', () => {
    const verde = { ...base0, id: 'v', type: 'solid', color: '#00ff00', xMm: 10, yMm: 10, wMm: 80, hMm: 60,
      mask: { enabled: true, invert: true, featherMm: 0, forma: { aneis: [[[0, 0], [0.5, 0], [0.5, 1], [0, 1]]], matrix: [80, 0, 0, 60, 10, 10] } } } as never
    const px = pixels([verde])
    expect(px(20, 40)).toEqual([255, 255, 255])
    expect(px(80, 40)).toEqual([0, 255, 0])
  })
  it('máscara de corte com a base em preenchimento 0%: a base some, o recortado continua (antes sumia junto)', () => {
    const baseRosa = { ...base0, id: 'b', type: 'shape', color: '#ff00ff', fill: 0, rings: [[[20, 20], [60, 20], [60, 60], [20, 60]]] } as never
    const papelAzul = { ...base0, id: 'p', type: 'solid', color: '#0000ff', xMm: 0, yMm: 0, wMm: 100, hMm: 80, clip: true } as never
    const px = pixels([baseRosa, papelAzul])
    expect(px(40, 40)).toEqual([0, 0, 255])          // papel dentro da forma
    expect(px(80, 70)).toEqual([255, 255, 255])      // fora da forma: nada
  })
  it('com a base visível (preenchimento 100%) continua como antes', () => {
    const baseRosa = { ...base0, id: 'b', type: 'shape', color: '#ff00ff', rings: [[[20, 20], [60, 20], [60, 60], [20, 60]]] } as never
    const metadeAzul = { ...base0, id: 'p', type: 'solid', color: '#0000ff', xMm: 40, yMm: 0, wMm: 60, hMm: 80, clip: true } as never
    const px = pixels([baseRosa, metadeAzul])
    expect(px(30, 40)).toEqual([255, 0, 255])
    expect(px(50, 40)).toEqual([0, 0, 255])
  })
})

describe('155/156 — aplique segue a arte (máscara, forma); aplique simples continua igual', () => {
  function kit(camada: Record<string, unknown>) {
    const d = novoDocumento('A4')
    d.artboards = [{ id: 'ab', widthMm: 297, heightMm: 210 }] as never
    d.molds.push({ id: 'm1', name: 'MILK', artboardId: 'ab', transform: { xMm: 0, yMm: 0, rotationDeg: 0 }, source: { path: 'x.pdf', sha256: '0'.repeat(64), widthMm: 100 }, faces: [{ id: 'm1_f', polygonMm: [[0, 0], [100, 0], [100, 80], [0, 80]] }] } as never)
    d.parts.push({ id: 'p', name: 'FRENTE', referenceAspect: 1.25, instances: [{ faceId: 'm1_f', fit: { mode: 'cover', scale: 1, offsetX: 0, offsetY: 0, rotationDeg: 0 } }] } as never)
    const tema = DocTemaZ.parse({ schemaVersion: 1, type: 'theme', id: 't', version: 1, baseId: d.id, baseVersion: 1, partContent: { p: [camada] } })
    tema.appliques = { enabled: true, borderMm: 1, borderColor: '#ffffff', silhouetteMm: 3 } as never
    return { d, tema }
  }
  const urso = { id: 'urso', type: 'image', anchor: 'face', path: 'Elementos/urso.png', sha256: 'uuuu', aspect: 1, transform: { x: 0.5, y: 0.5, scale: 0.4, rotationDeg: 0 }, applique: { enabled: true } }
  it('imagem simples: o caminho de sempre (sem "peça desenhada")', () => {
    const { d, tema } = kit(urso)
    const a = acharApliques(d, tema)
    expect(a.length).toBe(1); expect(a[0].no).toBeUndefined(); expect(a[0].wMm).toBeCloseTo(40, 6)
  })
  it('imagem com máscara (só a parte de cima): a peça é a camada como desenhada, com a máscara', () => {
    const { d, tema } = kit({ ...urso, mask: { enabled: true, invert: false, featherMm: 0, forma: { aneis: [[[0, 0], [1, 0], [1, 0.5], [0, 0.5]]] } } })
    const a = acharApliques(d, tema)
    expect(a.length).toBe(1)
    expect(a[0].no?.type).toBe('image')
    expect((a[0].no as { mask?: { forma?: unknown } }).mask?.forma).toBeTruthy()
    const f = montarFolhas([{ ...a[0], borda: [], silhueta: [[[0, 0], [40, 0], [40, 20], [0, 20]]] }], { wMm: 210, hMm: 297 })
    const img = f.impressos.find(n => n.type === 'image') as { mask?: { forma?: { matrix: number[] } }; matrix: number[] }
    expect(img.mask?.forma?.matrix).toEqual(img.matrix)            // a máscara anda junto com a peça na folha
  })
  it('FORMA marcada como aplique 3D vira peça (antes só PNG)', () => {
    const { d, tema } = kit({ id: 'circ', type: 'shape', kind: 'ellipse', params: { radius: 0, sides: 6, inner: 0.5 }, fill: '#ffcc00', stroke: null, aspect: 1, transform: { x: 0.5, y: 0.5, scale: 0.3, rotationDeg: 0 }, applique: { enabled: true } })
    const a = acharApliques(d, tema)
    expect(a.length).toBe(1)
    expect(a[0].no?.type).toBe('path')
    expect(a[0].wMm).toBeGreaterThan(20)
  })
})

describe('154 — preset de moldurinha guarda os efeitos', () => {
  it('o preset aceita a moldura (parâmetros + "em cada face") junto com os efeitos', async () => {
    const { Preset } = await import('@/lib/mae/efeitos/presets')
    const p = Preset.parse({ id: 'moldura_x', name: 'Moldura dourada', effects: [{ type: 'stroke', sizeMm: 0.6, color: '#d4af37', position: 'outside', opacity: 1, enabled: true, blendMode: 'normal' }], moldura: { params: { offsetMm: 3, widthMm: 0.8 }, porFace: true } })
    expect(p.moldura?.porFace).toBe(true)
    expect(p.effects.length).toBe(1)
  })
})
