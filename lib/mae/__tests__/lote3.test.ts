// Lote 3 (reteste da Naty, 05/10/2026, noite) — pendências do Lote 1 e itens 27 a 36.
import { describe, it, expect } from 'vitest'
import { createCanvas, Path2D as P2D } from '@napi-rs/canvas'
import { resolverPrancheta, posicaoEfetiva } from '@/lib/mae/vinculo/resolver'
import { atribuirFace, garantirPartesPadrao } from '@/lib/mae/vinculo/partes'
import { colocarCor, criarMoldura, novoTema } from '@/lib/mae/vinculo/tema'
import { renderizarPrancheta, tamanhoDoCanvas, type CanvasLike } from '@/lib/mae/render'
import { facesParaReceita } from '@/lib/mae/editor/moldes'
import { novoDocumento } from '@/lib/mae/schema/documento'
import { duplicarPrancheta } from '@/lib/mae/editor/pranchetas'
import type { DocTema, DocTrabalho } from '@/lib/mae/schema'
import type { Pt } from '@/lib/mae/faces/geometria'

/** Base com UMA face triangular (a da Naty no teste): 100 mm de base, 90 mm de altura, em (50, 50). */
function baseTriangulo(): DocTrabalho {
  const d = novoDocumento('A4'); d.artboards[0] = { id: 'ab_1', widthMm: 210, heightMm: 297 }
  const tri: Pt[] = [[50, 0], [100, 90], [0, 90]]
  d.molds = [{ id: 'a', name: 'TRIANGULOVE', artboardId: 'ab_1', transform: { xMm: 50, yMm: 50, rotationDeg: 0 }, source: { path: 'Bases/moldes/a.pdf', sha256: 'a'.padEnd(64, '0'), widthMm: 100, heightMm: 90 },
    faces: facesParaReceita('a', [{ poligono: tri, tipos: ['cut', 'cut', 'cut'], furo: false }]) }] as never
  garantirPartesPadrao(d); atribuirFace(d, 'p_frente', 'f_a_1')
  return d
}
const k = 4
const perto = (a: number[], b: number[], tol = 14) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= tol)
function desenhar(d: DocTrabalho, t: DocTema) {
  const p = { id: 'ab_1', widthMm: 210, heightMm: 297, layers: resolverPrancheta(d, 'ab_1', { tema: t }) }
  const { w, h } = tamanhoDoCanvas(p, k), c = createCanvas(w, h)
  renderizarPrancheta(c as unknown as CanvasLike, p, { pxPorMm: k, fundo: '#ffffff', criarCanvas: (a, b) => createCanvas(a, b) as unknown as CanvasLike, bitmap: () => null as unknown as CanvasImageSource, criarCaminho: s => new P2D(s) as unknown as Path2D })
  const g = c.getContext('2d')
  return (x: number, y: number) => Array.from(g.getImageData(Math.floor(x * k), Math.floor(y * k), 1, 1).data).slice(0, 3)
}

describe('32 · estilos de camada na moldurinha acompanham a linha', () => {
  // triângulo na folha: topo (100, 50), base y = 140 de x 50 a 150. Moldura: recuo 6 mm, 1 mm de linha.
  const comEfeito = (efs: unknown[]) => {
    const t = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    colocarCor(t, { partId: 'p_frente' }, '#ffffff')   // a face tem papel/cor no uso real
    const id = criarMoldura(t, { partId: 'p_frente' }, { offsetMm: 6, widthMm: 1, dash: null, cornerMm: 0, color: '#ff0000' })
    const c = t.partContent.p_frente.find(x => x.id === id)! as { effects?: unknown[] }
    c.effects = efs
    return desenhar(baseTriangulo(), t)
  }
  it('Traçado por fora: contorna a linha dos dois lados, o meio da face fica limpo (sem faixas nem corte reto)', () => {
    const px = comEfeito([{ type: 'stroke', enabled: true, opacity: 1, blendMode: 'normal', sizeMm: 1, color: '#0000ff', position: 'outside' }])
    // linha de baixo da moldura: a base do triângulo (y 140) recuada 6 + 0,5 = y 133,5 (linha de 133 a 134)
    expect(perto(px(100, 133.5), [255, 0, 0])).toBe(true)           // a linha continua vermelha
    expect(perto(px(100, 134.6), [0, 0, 255])).toBe(true)           // traçado logo abaixo da linha
    expect(perto(px(100, 132.4), [0, 0, 255])).toBe(true)           // e logo acima (anel: os dois lados)
    expect(perto(px(100, 128), [255, 255, 255])).toBe(true)         // longe da linha: nada
    // nenhuma "linha reta horizontal" atravessando a face no meio dela
    for (let x = 85; x <= 115; x += 2.5) expect(perto(px(x, 110), [255, 255, 255])).toBe(true)
  })
  it('sombra, brilho e chanfro também ficam presos à linha', () => {
    for (const ef of [
      { type: 'dropShadow', enabled: true, opacity: 1, blendMode: 'normal', color: '#00ff00', angleDeg: 90, distanceMm: 0, sizeMm: 0.5, spread: 1 },
      { type: 'outerGlow', enabled: true, opacity: 1, blendMode: 'normal', color: '#00ff00', sizeMm: 1, spread: 1 },
      { type: 'bevel', enabled: true, opacity: 1, blendMode: 'normal', style: 'inner', sizeMm: 0.5, depth: 1, angleDeg: 120, highlight: '#ffffff', shadow: '#000000' },
    ]) {
      const px = comEfeito([ef])
      expect(perto(px(100, 110), [255, 255, 255]), ef.type).toBe(true)   // o meio da face não muda
      expect(perto(px(100, 120), [255, 255, 255]), ef.type).toBe(true)
    }
  })
})

describe('9 · girar o texto em todas as caixas (painel de texto)', () => {
  it('giro do estilo soma com o da posição e o "só nesta caixa"', () => {
    const t = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    t.textStyles = { NOME: { rotationDeg: 20 } as never }
    t.textSlotAdjust = { s1: { rotationDeg: 5 } }
    const slot = { id: 's1', variable: 'NOME', faceId: 'f', box: { x: 0.1, y: 0.4, w: 0.8, h: 0.2 }, rotationDeg: 10 }
    expect(posicaoEfetiva(slot as never, t).rotacaoDeg).toBe(35)
  })
})

describe('12 · duplicar página do editor livre', () => {
  it('a cópia leva as camadas com ids NOVOS', () => {
    const d = novoDocumento('A4')
    d.artboards[0].layers = [{ id: 'ly_1', type: 'group', name: 'G', visible: true, locked: false, opacity: 1, fill: 1, blendMode: 'normal', children: [{ id: 'ly_2', type: 'solid', name: 'S', visible: true, locked: false, opacity: 1, fill: 1, blendMode: 'normal', xMm: 0, yMm: 0, wMm: 10, hMm: 10, rotationDeg: 0, color: '#000' }] }] as never
    const id = duplicarPrancheta(d, d.artboards[0].id)!
    const c = d.artboards.find(a => a.id === id)!.layers as unknown as { id: string; children: { id: string }[] }[]
    expect(c[0].id).not.toBe('ly_1'); expect(c[0].children[0].id).not.toBe('ly_2')
    expect((d.artboards[0].layers as unknown as { id: string }[])[0].id).toBe('ly_1')
  })
})

// ── 31 e 30: linha do tempo global e "salvo" ─────────────────────────────────────────────────────
import { useMaeDoc } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { registrarFonte, desfazerGlobal, refazerGlobal, rotulo, alteradoDesde, useLinha } from '@/lib/mae/editor/linhaDoTempo'
import { facesSemPapel } from '@/lib/mae/vinculo/partes'
import { azulejos } from '@/lib/mae/vinculo/resolver'
import { colocarPapel } from '@/lib/mae/vinculo/tema'

describe('31 · Ctrl+Z global: desfaz o ÚLTIMO passo, da base ou do tema', () => {
  it('no Tema, criar prancheta (base) e depois mexer no tema: desfaz na ordem certa', () => {
    useLinha.setState({ feitos: [], desfeitos: [] })
    useMaeDoc.getState().carregar(novoDocumento('A4'))
    useMaeTema.getState().carregar(novoTema({ nome: 't', baseId: 'b', baseVersion: 1 }))
    let modo = 'tema'
    registrarFonte('base', { hist: () => useMaeDoc.getState().hist as never, desfazer: () => useMaeDoc.getState().desfazer(), refazer: () => useMaeDoc.getState().refazer(), ativa: () => true })
    registrarFonte('tema', { hist: () => useMaeTema.getState().hist as never, desfazer: () => useMaeTema.getState().desfazer(), refazer: () => useMaeTema.getState().refazer(), ativa: () => modo === 'tema' })
    useMaeTema.getState().aplicar('Nome do tema', t => { t.name = 'A' })
    useMaeDoc.getState().adicionarPrancheta('A5')
    expect(useMaeDoc.getState().hist.atual.artboards).toHaveLength(2)
    expect(rotulo('desfazer')).toBe('Adicionar prancheta')
    desfazerGlobal()                                               // 1º Ctrl+Z: a prancheta (antes desfazia o tema)
    expect(useMaeDoc.getState().hist.atual.artboards).toHaveLength(1)
    expect(useMaeTema.getState().hist!.atual.name).toBe('A')
    desfazerGlobal()                                               // 2º: o nome do tema
    expect(useMaeTema.getState().hist!.atual.name).toBe('t')
    refazerGlobal(); refazerGlobal()                               // Ctrl+Shift+Z / Ctrl+Y: na mesma ordem
    expect(useMaeTema.getState().hist!.atual.name).toBe('A'); expect(useMaeDoc.getState().hist.atual.artboards).toHaveLength(2)
    modo = 'base'                                                  // fora do Tema, o tema não é desfeito
    useMaeTema.getState().aplicar('Nome do tema', t => { t.name = 'B' })
    desfazerGlobal()
    expect(useMaeTema.getState().hist!.atual.name).toBe('B'); expect(useMaeDoc.getState().hist.atual.artboards).toHaveLength(1)
  })
  it('deslizar um controle (passos juntados) = 1 entrada na linha do tempo', () => {
    useLinha.setState({ feitos: [], desfeitos: [] })
    useMaeDoc.getState().carregar(novoDocumento('A4'))
    for (let i = 1; i <= 5; i++) useMaeDoc.getState().aplicar('Largura', d => { d.artboards[0].widthMm = 200 + i }, 'larg')
    expect(useLinha.getState().feitos).toEqual(['base'])
  })
})

describe('30 · alterações não salvas', () => {
  it('marca de "salvo": mudou → pergunta; desfez até o salvo → não; só arrumar pranchetas não conta', () => {
    useMaeDoc.getState().carregar(novoDocumento('A4'))
    const st = () => useMaeDoc.getState()
    expect(alteradoDesde(st().hist as never, st().marca)).toBe(false)
    st().aplicar('Mover prancheta', d => { d.artboards[0].xMm = 10 })
    expect(alteradoDesde(st().hist as never, st().marca)).toBe(false)          // só vista
    st().aplicar('Nome da base', d => { d.name = 'KIT FESTA' })
    expect(alteradoDesde(st().hist as never, st().marca)).toBe(true)
    st().marcarSalvo()
    expect(alteradoDesde(st().hist as never, st().marca)).toBe(false)
    st().desfazer()                                                            // desfez para antes do salvo
    expect(alteradoDesde(st().hist as never, st().marca)).toBe(true)
    st().refazer()
    expect(alteradoDesde(st().hist as never, st().marca)).toBe(false)
  })
  it('36 · Base e Editor livre com documentos separados', () => {
    useMaeDoc.getState().carregar(novoDocumento('A4', 'retrato', 'KIT FESTA'))
    useMaeDoc.getState().trocarContexto('imagem')
    expect(useMaeDoc.getState().hist.atual.name).toBe('Design sem nome')
    useMaeDoc.getState().aplicar('Nome', d => { d.name = 'Convite' })
    useMaeDoc.getState().trocarContexto('base')
    expect(useMaeDoc.getState().hist.atual.name).toBe('KIT FESTA')
    useMaeDoc.getState().trocarContexto('imagem')
    expect(useMaeDoc.getState().hist.atual.name).toBe('Convite')
    useMaeDoc.getState().trocarContexto('base')
  })
})

describe('35 · tema avisa face sem papel', () => {
  it('face de uma parte ainda vazia = sem papel; aba sem parte não conta', () => {
    const d = baseTriangulo()
    const t = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    expect(facesSemPapel(d, t)).toEqual(['f_a_1'])
    colocarCor(t, { partId: 'p_frente' }, '#ffffff')
    expect(facesSemPapel(d, t)).toEqual([])
    d.molds[0].faces.push({ id: 'f_a_2', polygonMm: [[0, 0], [10, 0], [10, 10]] } as never)
    expect(facesSemPapel(d, t)).toEqual([])                       // face sem parte = aba (a arte inteligente cobre)
    atribuirFace(d, 'p_verso', 'f_a_2')                           // face nova numa parte que o tema ainda não vestiu
    expect(facesSemPapel(d, t)).toEqual(['f_a_2'])
  })
})

describe('29 · papel em padrão repetido', () => {
  it('azulejos do mesmo tamanho em mm em qualquer face; espelhados alternados; cobre a face com folga', () => {
    const c = { id: 'p', type: 'image', path: 'Papéis/x.png', aspect: 2, anchor: 'paper', repeat: { sizeMm: 20, mirror: true } } as never
    const a = azulejos(c, [[0, 0], [100, 0], [100, 30], [0, 30]], [50, 50], 0)
    expect(a.every(t => Math.abs(Math.abs(t.matrix[0]) - 20) < 1e-6 && Math.abs(Math.abs(t.matrix[3]) - 10) < 1e-6)).toBe(true)   // 20 × 10 mm (proporção 2)
    expect(a).toHaveLength(5 * 3)
    expect(a.filter(t => t.flipX).length).toBeGreaterThan(0)
    const b = azulejos(c, [[0, 0], [300, 0], [300, 30], [0, 30]], [0, 0], 0)
    expect(Math.abs(b[0].matrix[0])).toBe(Math.abs(a[0].matrix[0]))   // mesma escala numa face 3× maior
  })
  it('na folha: a estampa repete (pixels) e a opacidade da camada vale', () => {
    const d = baseTriangulo()
    const t = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    colocarPapel(t, 'p_frente', { path: 'Papéis/xadrez.png', sha256: 'xxxx', aspect: 1 })
    const papel = t.partContent.p_frente.find(c => c.type === 'image') as { repeat?: unknown; opacity?: number }
    papel.repeat = { sizeMm: 10 }
    // azulejo: metade de cima preta, de baixo branca → listras a cada 5 mm
    const az = createCanvas(20, 20), g = az.getContext('2d'); g.fillStyle = '#000000'; g.fillRect(0, 0, 20, 10); g.fillStyle = '#ffffff'; g.fillRect(0, 10, 20, 10)
    const render = () => {
      const p = { id: 'ab_1', widthMm: 210, heightMm: 297, layers: resolverPrancheta(d, 'ab_1', { tema: t }) }
      const { w, h } = tamanhoDoCanvas(p, k), cv = createCanvas(w, h)
      renderizarPrancheta(cv as unknown as CanvasLike, p, { pxPorMm: k, fundo: '#ffffff', criarCanvas: (a, b) => createCanvas(a, b) as unknown as CanvasLike, bitmap: () => az as unknown as CanvasImageSource, criarCaminho: s => new P2D(s) as unknown as Path2D })
      return (x: number, y: number) => Array.from(cv.getContext('2d').getImageData(Math.floor(x * k), Math.floor(y * k), 1, 1).data).slice(0, 3)
    }
    // a face começa em y = 50 (topo do triângulo): faixas pretas em 50–55, 60–65…, brancas em 55–60…
    let px = render()
    expect(perto(px(100, 122.5), [0, 0, 0])).toBe(true); expect(perto(px(100, 127.5), [255, 255, 255])).toBe(true)
    papel.opacity = 0.5
    px = render()
    const v = px(100, 122.5)[0]
    expect(v).toBeGreaterThan(100); expect(v).toBeLessThan(160)          // preto a 50% sobre branco ≈ 128
  })
})

describe('32 · caixa das formas e cores = [x0, y0, x1, y1]', () => {
  it('cor sólida com sombra: o efeito não corta a cor', () => {
    const t = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    const id = colocarCor(t, { partId: 'p_frente' }, '#00ff00')
    ;(t.partContent.p_frente.find(c => c.id === id) as { effects?: unknown[] }).effects = [{ type: 'dropShadow', enabled: true, opacity: 1, blendMode: 'normal', color: '#000000', angleDeg: 90, distanceMm: 0, sizeMm: 0, spread: 0 }]
    const px = desenhar(baseTriangulo(), t)
    expect(perto(px(100, 130), [0, 255, 0])).toBe(true); expect(perto(px(100, 90), [0, 255, 0])).toBe(true)   // a cor preenche a face toda
  })
})
