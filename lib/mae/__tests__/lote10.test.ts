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

import { contornoDaForma } from '@/lib/mae/edicao/formas'
import { conjuntoPadrao, conjuntoDoAplique, matrizDaPeca } from '@/lib/mae/vinculo/conjunto'

describe('157 — conjunto de aplique (peças empilhadas, por material)', () => {
  function kitCj(camadas: Record<string, unknown>[]) {
    const d = novoDocumento('A4')
    d.artboards = [{ id: 'ab', widthMm: 297, heightMm: 210 }] as never
    d.molds.push({ id: 'm1', name: 'MILK', artboardId: 'ab', transform: { xMm: 0, yMm: 0, rotationDeg: 0 }, source: { path: 'x.pdf', sha256: '0'.repeat(64), widthMm: 100 }, faces: [{ id: 'm1_f', polygonMm: [[0, 0], [100, 0], [100, 100], [0, 100]] }] } as never)
    d.parts.push({ id: 'p', name: 'FRENTE', referenceAspect: 1, instances: [{ faceId: 'm1_f', fit: { mode: 'cover', scale: 1, offsetX: 0, offsetY: 0, rotationDeg: 0 } }] } as never)
    const tema = DocTemaZ.parse({ schemaVersion: 1, type: 'theme', id: 't', version: 1, baseId: d.id, baseVersion: 1, partContent: { p: camadas } })
    tema.appliques = { enabled: true, borderMm: 1, borderColor: '#ffffff', silhouetteMm: 3 } as never
    return { d, tema }
  }
  const cj = () => {
    const c = conjuntoDoAplique({ id: 'urso', name: 'Urso', path: 'Elementos/urso.png', sha256: 'uuuu', aspect: 1, transform: { x: 0.5, y: 0.5, scale: 0.4, rotationDeg: 0 } })
    return JSON.parse(JSON.stringify(c)) as Record<string, unknown>
  }
  it('o schema aceita o conjunto e mantém temas antigos', () => {
    const { tema } = kitCj([cj()])
    const c = tema.partContent.p[0] as unknown as { type: string; pecas: unknown[] }
    expect(c.type).toBe('conjunto'); expect(c.pecas.length).toBe(3)
  })
  it('3 peças (escalope dourado só recorte + círculo impresso + personagem): na arte, um grupo só, na ordem', () => {
    const { d, tema } = kitCj([cj()])
    const nos = resolverPrancheta(d, 'ab', { tema })
    const g = nos.flatMap(n => n.type === 'group' ? [n, ...(n as { children: NoCamada[] }).children] : [n]).find(n => n.type === 'group' && (n as { children: NoCamada[] }).children.length === 3) as { children: NoCamada[] } | undefined
    expect(g).toBeTruthy()
    // a de baixo é o escalope (cor do material)
    expect(JSON.stringify(g!.children[0])).toContain('#d4af37')
  })
  it('folhas: personagem e círculo IMPRESSOS; escalope na folha de recorte "Dourado"', () => {
    const { d, tema } = kitCj([cj()])
    const a = acharApliques(d, tema)
    expect(a.length).toBe(3)
    const rec = a.filter(x => x.material)
    expect(rec.map(x => x.material)).toEqual(['Dourado'])
    expect(rec[0].cfg.borderMm).toBe(0)
    expect(a.filter(x => !x.material).length).toBe(2)
    // o conjunto tem 0,4×1,35 = 54% da face (100 mm) → o escalope (escala 1) ≈ 54 mm
    expect(rec[0].wMm).toBeGreaterThan(50); expect(rec[0].wMm).toBeLessThan(58)
    // o personagem (escala 0,7) ≈ 70% do escalope
    const urso = a.find(x => x.moldeNome.includes('Urso'))!
    expect(urso.wMm / rec[0].wMm).toBeCloseTo(0.7, 1)
  })
  it('matriz da peça: centro e largura relativos ao quadro do conjunto', () => {
    expect(matrizDaPeca(1, { escala: 0.5, x: 0.5, y: 0.5, aspect: 1 } as never)).toEqual([0.5, 0, 0, 0.5, 0.25, 0.25])
    expect(matrizDaPeca(1, { escala: 1, x: 0.5, y: 0.5, aspect: 2 } as never)).toEqual([1, 0, 0, 0.5, 0, 0.25])
  })
  it('conjunto padrão é válido no schema', () => {
    const { tema } = kitCj([JSON.parse(JSON.stringify(conjuntoPadrao()))])
    expect((tema.partContent.p[0] as { type: string }).type).toBe('conjunto')
  })
  it('preset de conjunto (nome dado pela usuária) passa no schema do preset', async () => {
    const { Preset } = await import('@/lib/mae/efeitos/presets')
    const p = Preset.parse({ id: 'conjunto_frame', name: 'Frame escalopado', effects: [], conjunto: { aspect: 1, pecas: (cj() as { pecas: unknown[] }).pecas } })
    expect(p.conjunto?.pecas.length).toBe(3)
  })
})

describe('158 — moldurinha em qualquer peça (acompanha o formato)', () => {
  it('escalope: contorno fechado com babados (raio oscila)', () => {
    const [anel] = contornoDaForma('scallop', { radius: 0, sides: 12, inner: 0.86 })
    expect(anel.length).toBeGreaterThan(48)
    const r = anel.map(([u, v]) => Math.hypot(u - 0.5, v - 0.5))
    expect(Math.max(...r) - Math.min(...r)).toBeGreaterThan(0.03)
    expect(Math.max(...r)).toBeLessThanOrEqual(0.5001)
  })
  it('moldurinha com alvo numa forma: contorna a forma (dentro dela), não a face', () => {
    const d = novoDocumento('A4')
    d.artboards = [{ id: 'ab', widthMm: 297, heightMm: 210 }] as never
    d.molds.push({ id: 'm1', name: 'MILK', artboardId: 'ab', transform: { xMm: 0, yMm: 0, rotationDeg: 0 }, source: { path: 'x.pdf', sha256: '0'.repeat(64), widthMm: 100 }, faces: [{ id: 'm1_f', polygonMm: [[0, 0], [100, 0], [100, 100], [0, 100]] }] } as never)
    d.parts.push({ id: 'p', name: 'FRENTE', referenceAspect: 1, instances: [{ faceId: 'm1_f', fit: { mode: 'cover', scale: 1, offsetX: 0, offsetY: 0, rotationDeg: 0 } }] } as never)
    const circ = { id: 'circ', type: 'shape', kind: 'ellipse', params: { radius: 0, sides: 6, inner: 0.5 }, fill: '#ffffff', stroke: null, aspect: 1, transform: { x: 0.5, y: 0.5, scale: 0.4, rotationDeg: 0 } }
    const mold = { id: 'mf', type: 'frame', alvo: 'circ', offsetMm: 2, widthMm: 0.6, dash: null, cornerMm: 0, color: '#ff0000', recortada: true }
    const tema = DocTemaZ.parse({ schemaVersion: 1, type: 'theme', id: 't', version: 1, baseId: d.id, baseVersion: 1, partContent: { p: [circ, mold] } })
    const nos = resolverPrancheta(d, 'ab', { tema })
    const todos = (ns: NoCamada[]): NoCamada[] => ns.flatMap(n => n.type === 'group' ? [n, ...todos((n as { children: NoCamada[] }).children)] : [n])
    const m = todos(nos).find(n => n.id.endsWith('mf')) as unknown as { type: string; bboxMm: number[] } | undefined
    expect(m?.type).toBe('path')
    // círculo de 40 mm centrado em (50,50); moldurinha 2 mm para dentro → caixa ≈ 36 mm, dentro do círculo
    const [x0, y0, x1, y1] = m!.bboxMm
    expect(x1 - x0).toBeGreaterThan(34); expect(x1 - x0).toBeLessThan(38)
    expect(x0).toBeGreaterThan(30); expect(x1).toBeLessThan(70); expect(y0).toBeGreaterThan(30); expect(y1).toBeLessThan(70)
  })
})

describe('157/158 — o conjunto na arte (pixels)', () => {
  it('escalope dourado por fora, círculo branco dentro, moldurinha dourada a 2 mm da borda do círculo', () => {
    const d = novoDocumento('A4')
    d.artboards = [{ id: 'ab', widthMm: 100, heightMm: 100 }] as never
    d.molds.push({ id: 'm1', name: 'MILK', artboardId: 'ab', transform: { xMm: 0, yMm: 0, rotationDeg: 0 }, source: { path: 'x.pdf', sha256: '0'.repeat(64), widthMm: 100 }, faces: [{ id: 'm1_f', polygonMm: [[0, 0], [100, 0], [100, 100], [0, 100]] }] } as never)
    d.parts.push({ id: 'p', name: 'FRENTE', referenceAspect: 1, instances: [{ faceId: 'm1_f', fit: { mode: 'cover', scale: 1, offsetX: 0, offsetY: 0, rotationDeg: 0 } }] } as never)
    const fundo = { id: 'fundo', type: 'solid', anchor: 'paper', color: '#0000ff' }
    const tema = DocTemaZ.parse({ schemaVersion: 1, type: 'theme', id: 't', version: 1, baseId: d.id, baseVersion: 1, partContent: { p: [fundo, JSON.parse(JSON.stringify(conjuntoPadrao()))] } })
    const nos = resolverPrancheta(d, 'ab', { tema })
    const k = 4, c = createCanvas(100 * k, 100 * k)
    renderizarPrancheta(c as unknown as CanvasLike, { id: 'ab', widthMm: 100, heightMm: 100, layers: nos } as never, { pxPorMm: k, fundo: '#ffffff', criarCanvas: criar, bitmap: () => undefined })
    const dt = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    const px = (x: number, y: number) => { const i = (Math.round(y * k) * c.width + Math.round(x * k)) * 4; return [dt[i], dt[i + 1], dt[i + 2]] }
    // conjunto: 45% da face → escalope raio 22,5 mm (vales em 0,86 → 19,35); círculo 0,82 → raio 18,45; moldurinha a 2 mm → ~16,45
    expect(px(50, 50)).toEqual([255, 255, 255])            // centro: círculo branco
    const dourado = (q: number[]) => Math.abs(q[0] - 0xd4) < 12 && Math.abs(q[1] - 0xaf) < 12 && Math.abs(q[2] - 0x37) < 12
    expect(dourado(px(50 + 19, 50))).toBe(true)            // a 0° é um VALE do escalope (19,35 mm): o anel dourado
    // num BABADO (15° do vale) o escalope vai até 22,5 mm
    const a = (-75 * Math.PI) / 180
    expect(dourado(px(50 + 21.5 * Math.cos(a), 50 + 21.5 * Math.sin(a)))).toBe(true)
    expect(px(50 + 21.5, 50)).toEqual([0, 0, 255])          // no vale, a 21,5 mm já é fundo
    expect(px(50 + 26, 50)).toEqual([0, 0, 255])            // fora: o fundo
    // moldurinha dourada dentro do círculo: 2 mm da borda (18,45) até a linha de 0,6 mm → ~15,85–16,45 mm
    const perto = [15.7, 15.9, 16.1, 16.3].map(r => px(50 + r, 50)).some(p => p[0] > 150 && p[2] < 120)
    expect(perto).toBe(true)
  })
})
