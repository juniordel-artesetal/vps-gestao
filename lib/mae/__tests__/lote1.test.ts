// Lote 1 (teste da Naty, 05/10/2026) — erros 1 a 4.
//  1. "Só nesta caixa" respeitado no que se SOLTA (miniatura da parte e face do palco, com ou sem Shift);
//  3. transição: Shift no palco EMPILHA (antes trocava o papel de baixo) e o papel de baixo aparece
//     pelo degradê da máscara; papel só da caixa fica logo acima dos papéis da parte, abaixo dos elementos.
import { describe, it, expect, beforeEach } from 'vitest'
import { createCanvas, Path2D as P2D } from '@napi-rs/canvas'
import { resolverPrancheta } from '@/lib/mae/vinculo/resolver'
import { atribuirFace, garantirPartesPadrao } from '@/lib/mae/vinculo/partes'
import { colocarNaFace, colocarPapel, colocarElemento, novoTema } from '@/lib/mae/vinculo/tema'
import { renderizarPrancheta, tamanhoDoCanvas, type CanvasLike } from '@/lib/mae/render'
import { facesParaReceita } from '@/lib/mae/editor/moldes'
import { novoDocumento } from '@/lib/mae/schema/documento'
import { useMaeDoc } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { useEditor } from '@/components/mae/estado'
import { soltarNaFace, soltarNaParte } from '@/components/mae/acoesVinculo'
import type { DocTema, DocTrabalho } from '@/lib/mae/schema'
import type { Pt } from '@/lib/mae/faces/geometria'

const ret = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
function base(): DocTrabalho {
  const d = novoDocumento('A4')
  d.artboards[0] = { id: 'ab_1', widthMm: 210, heightMm: 297 }
  const molde = (id: string, x: number, faces: Pt[][]) => ({
    id, name: id, artboardId: 'ab_1', transform: { xMm: x, yMm: 10, rotationDeg: 0 },
    source: { path: `Bases/moldes/${id}.pdf`, sha256: id.padEnd(64, '0'), widthMm: 90, heightMm: 120 },
    faces: facesParaReceita(id, faces.map(p => ({ poligono: p, tipos: p.map(() => 'cut' as const), furo: false }))),
  })
  d.molds = [molde('a', 10, [ret(5, 5, 60, 80)]), molde('b', 110, [ret(5, 5, 80, 100)])]
  garantirPartesPadrao(d); atribuirFace(d, 'p_frente', 'f_a_1'); atribuirFace(d, 'p_frente', 'f_b_1')
  return d
}
const vermelho = { path: 'Papéis/vermelho.png', sha256: 'vvvv', aspect: 1 }
const azul = { path: 'Papéis/azul.png', sha256: 'aaaa', aspect: 1 }
const flor = { path: 'Elementos/flor.png', sha256: 'ffff', aspect: 1 }
const tema = () => useMaeTema.getState().hist!.atual as DocTema

describe('1 · "Só nesta caixa" no que se solta', () => {
  beforeEach(() => {
    useMaeDoc.getState().carregar(base())
    const t = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    colocarPapel(t, 'p_frente', vermelho)
    useMaeTema.getState().carregar(t)
    useEditor.setState({ escopo: null, face: null })
  })
  it('miniatura da parte com "Só nesta caixa" → só na caixa de contexto (com Shift: por cima)', () => {
    useEditor.setState({ escopo: 'face', face: 'f_a_1' })
    soltarNaParte('p_frente', azul, true)
    expect(tema().partContent.p_frente).toHaveLength(1)                    // a parte não mudou
    expect(tema().faceContent.f_a_1.map(c => (c as { path?: string }).path)).toEqual(['Papéis/azul.png'])
    expect(tema().faceContent.f_b_1).toBeUndefined()
  })
  it('face do palco com "Só nesta caixa" (sem Alt) → só naquela caixa', () => {
    useEditor.setState({ escopo: 'face', face: 'f_a_1' })
    soltarNaFace('f_b_1', null, azul, false, true)
    expect(tema().partContent.p_frente).toHaveLength(1)
    expect(tema().faceContent.f_b_1.map(c => (c as { path?: string }).path)).toEqual(['Papéis/azul.png'])
  })
  it('sem "Só nesta caixa": Shift no palco EMPILHA o papel na parte (não troca o de baixo)', () => {
    soltarNaFace('f_a_1', null, azul, false, true)
    expect(tema().partContent.p_frente.map(c => (c as { path?: string }).path)).toEqual(['Papéis/vermelho.png', 'Papéis/azul.png'])
    soltarNaFace('f_a_1', null, { ...azul, path: 'Papéis/outro.png' }, false, false)   // sem Shift: troca o fundo
    expect(tema().partContent.p_frente.map(c => (c as { path?: string }).path)).toEqual(['Papéis/outro.png', 'Papéis/azul.png'])
  })
})

describe('3 · transição entre papéis', () => {
  it('papel só da caixa fica logo acima dos papéis da parte e abaixo dos elementos', () => {
    const t = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    colocarPapel(t, 'p_frente', vermelho); colocarElemento(t, 'p_frente', flor)
    colocarNaFace(t, 'f_a_1', azul, 'paper', undefined, true)
    const ids = resolverPrancheta(base(), 'ab_1', { tema: t }).filter(n => n.id.startsWith('f_a_1') && n.type === 'image').map(n => (n as { src: { path: string } }).src.path)
    expect(ids).toEqual(['Papéis/vermelho.png', 'Papéis/azul.png', 'Elementos/flor.png'])
  })
  it('degradê na máscara do papel de cima REVELA o papel de baixo', () => {
    const t = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    colocarPapel(t, 'p_frente', vermelho)
    colocarPapel(t, 'p_frente', azul, true)
    const cima = t.partContent.p_frente[1] as { mask?: unknown }
    cima.mask = { enabled: true, invert: false, featherMm: 0, gradient: { type: 'linear', x0: 0.4, y0: 0.5, x1: 0.6, y1: 0.5, stops: [{ pos: 0, alpha: 0 }, { pos: 1, alpha: 1 }] } }
    const k = 2, layers = resolverPrancheta(base(), 'ab_1', { tema: t })
    const p = { id: 'ab_1', widthMm: 210, heightMm: 297, layers }
    const { w, h } = tamanhoDoCanvas(p, k), c = createCanvas(w, h)
    const cor = (hex: string) => { const x = createCanvas(16, 16), g = x.getContext('2d'); g.fillStyle = hex; g.fillRect(0, 0, 16, 16); return x }
    const imgs: Record<string, unknown> = { vvvv: cor('#ff0000'), aaaa: cor('#0000ff') }
    renderizarPrancheta(c as unknown as CanvasLike, p, { pxPorMm: k, fundo: '#ffffff', criarCanvas: (a, b) => createCanvas(a, b) as unknown as CanvasLike, bitmap: s => imgs[s] as CanvasImageSource })
    const px = (x: number, y: number) => Array.from(c.getContext('2d').getImageData(x * k, y * k, 1, 1).data).slice(0, 3)
    expect(px(20, 55)).toEqual([255, 0, 0])     // lado transparente do degradê: aparece o papel de BAIXO
    expect(px(70, 55)).toEqual([0, 0, 255])     // lado cheio: o papel de cima
    const [r, , b] = px(45, 55); expect(r).toBeGreaterThan(20); expect(b).toBeGreaterThan(20)   // no meio: mistura
  })
})

// ── Etapa 2 · item 5: botão "Transição" ─────────────────────────────────────────────────────────────
import { degradeDaTransicao } from '@/lib/mae/vinculo/transicao'
import { tDoDegrade } from '@/lib/mae/edicao/pintura'
import { criarTransicao, ajustarTransicao } from '@/lib/mae/vinculo/tema'

const alfa = (g: ReturnType<typeof degradeDaTransicao>, x: number, y: number) => {
  const t = tDoDegrade(g.type, x, y, g.x0, g.y0, g.x1, g.y1), [a, b] = g.stops
  return t <= a.pos ? a.alpha : t >= b.pos ? b.alpha : a.alpha + (b.alpha - a.alpha) * (t - a.pos) / (b.pos - a.pos)
}
describe('5 · transição de papéis', () => {
  it('cada direção: o papel novo inteiro de um lado, some no outro; posição e suavidade', () => {
    const g = degradeDaTransicao({ dir: 'baixo', pos: 0.5, soft: 0.2 })
    expect(alfa(g, 0.5, 0.1)).toBe(1); expect(alfa(g, 0.5, 0.9)).toBe(0); expect(alfa(g, 0.5, 0.5)).toBeCloseTo(0.5, 2)
    expect(alfa(degradeDaTransicao({ dir: 'cima', pos: 0.5, soft: 0.2 }), 0.5, 0.9)).toBe(1)
    expect(alfa(degradeDaTransicao({ dir: 'direita', pos: 0.5, soft: 0.2 }), 0.1, 0.5)).toBe(1)
    expect(alfa(degradeDaTransicao({ dir: 'esquerda', pos: 0.5, soft: 0.2 }), 0.9, 0.5)).toBe(1)
    const c = degradeDaTransicao({ dir: 'centro', pos: 0.3, soft: 0.1 })
    expect(alfa(c, 0.5, 0.5)).toBe(1); expect(alfa(c, 0.02, 0.02)).toBe(0)
    // posição move o meio da faixa; suavidade alarga
    expect(alfa(degradeDaTransicao({ dir: 'baixo', pos: 0.8, soft: 0.1 }), 0.5, 0.6)).toBe(1)
    expect(alfa(degradeDaTransicao({ dir: 'baixo', pos: 0.5, soft: 1 }), 0.5, 0.25)).toBeCloseTo(0.75, 2)
  })
  it('cria a camada por cima com a máscara; na caixa (só nesta caixa) ou na parte; ajustar refaz o degradê', () => {
    const t = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    colocarPapel(t, 'p_frente', vermelho)
    const id = criarTransicao(t, { partId: 'p_frente' }, azul, { dir: 'baixo', pos: 0.5, soft: 0.3 })
    expect(t.partContent.p_frente.map(c => c.id).indexOf(id)).toBe(1)
    const c = t.partContent.p_frente[1]
    expect(c.transition).toEqual({ dir: 'baixo', pos: 0.5, soft: 0.3 }); expect(c.mask?.gradient?.y0).toBeCloseTo(0.35)
    ajustarTransicao(t, id, { pos: 0.7 })
    expect(c.mask?.gradient?.y0).toBeCloseTo(0.55)
    const so = criarTransicao(t, { faceId: 'f_a_1' }, azul, { dir: 'centro', pos: 0.5, soft: 0.3 })
    expect(t.faceContent.f_a_1.map(x => x.id)).toEqual([so]); expect(t.faceContent.f_a_1[0].mask?.gradient?.type).toBe('radial')
  })
})

// ── Etapa 3 · item 6: Moldurinha ─────────────────────────────────────────────────────────────────────
import { linhaDaMoldura, noMoldura } from '@/lib/mae/vinculo/moldura'
import { criarMoldura, colocarCor } from '@/lib/mae/vinculo/tema'
import { DocTema as DocTemaZ } from '@/lib/mae/schema'

const desenhar = (t: DocTema, k = 4) => {
  const layers = resolverPrancheta(base(), 'ab_1', { tema: t })
  const p = { id: 'ab_1', widthMm: 210, heightMm: 297, layers }
  const { w, h } = tamanhoDoCanvas(p, k), c = createCanvas(w, h)
  renderizarPrancheta(c as unknown as CanvasLike, p, { pxPorMm: k, fundo: '#ffffff', criarCanvas: (a, b) => createCanvas(a, b) as unknown as CanvasLike, bitmap: () => undefined as unknown as CanvasImageSource, criarCaminho: d => new P2D(d) as unknown as Path2D })
  return (x: number, y: number) => Array.from(c.getContext('2d').getImageData(Math.floor(x * k), Math.floor(y * k), 1, 1).data).slice(0, 3)
}
describe('6 · moldurinha', () => {
  const face = ret(0, 0, 60, 80)
  it('linha central recuada da borda (distância + metade da espessura); face pequena demais → some', () => {
    const [a] = linhaDaMoldura(face, { offsetMm: 3, widthMm: 0.6, cornerMm: 0 })
    const xs = a.map(p => p[0]), ys = a.map(p => p[1])
    expect(Math.min(...xs)).toBeCloseTo(3.3, 2); expect(Math.max(...xs)).toBeCloseTo(56.7, 2); expect(Math.min(...ys)).toBeCloseTo(3.3, 2)
    expect(linhaDaMoldura(ret(0, 0, 5, 5), { offsetMm: 3, widthMm: 1, cornerMm: 0 })).toEqual([])
  })
  it('cantos arredondados: o canto fica a "raio" de distância do canto vivo', () => {
    const [a] = linhaDaMoldura(face, { offsetMm: 3, widthMm: 0.6, cornerMm: 5 })
    const canto = Math.min(...a.map(([x, y]) => Math.hypot(x - 3.3, y - 3.3)))
    expect(canto).toBeGreaterThan(1.5)                       // vivo seria 0
    expect(Math.min(...a.map(p => p[0]))).toBeCloseTo(3.3, 1) // os lados continuam no lugar
  })
  it('pesponto vai no traçado; na folha: contínua pinta a linha toda, pesponto alterna', () => {
    // Lote 3 (item 32): a moldura é a FORMA da linha (preenchida), não um traço — pesponto = um pedaço por traço
    const pesp = noMoldura('m', 'M', face, [0, 0], { offsetMm: 3, widthMm: 1, cornerMm: 0, color: '#ff0000', dash: { onMm: 2, offMm: 2 } })!
    expect(pesp.stroke).toBeUndefined(); expect(pesp.fillNone).toBeFalsy(); expect(pesp.d.split('M').length - 1).toBeGreaterThan(10)
    const t = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    criarMoldura(t, { faceId: 'f_a_1' }, { offsetMm: 5, widthMm: 1, dash: null, cornerMm: 0, color: '#ff0000' })
    // face f_a_1 em x 15..75, y 15..95 → linha central da moldura em x = 15 + 5.5 = 20.5
    let px = desenhar(t)
    expect(px(20.5, 50)).toEqual([255, 0, 0]); expect(px(20.5, 52)).toEqual([255, 0, 0]); expect(px(25, 50)).toEqual([255, 255, 255])
    expect(px(130, 50)).toEqual([255, 255, 255])            // a outra caixa (sem moldura) não tem
    const t2 = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    criarMoldura(t2, { partId: 'p_frente' }, { offsetMm: 5, widthMm: 1, dash: { onMm: 3, offMm: 3 }, cornerMm: 0, color: '#ff0000' })
    px = desenhar(t2)
    const amostras = Array.from({ length: 24 }, (_, i) => px(20.5, 30 + i * 0.5)[1] === 0)
    expect(amostras.some(Boolean) && amostras.some(v => !v)).toBe(true)   // traço e espaço
    expect(Array.from({ length: 24 }, (_, i) => px(120.5, 30 + i * 0.5)[1] === 0).some(Boolean)).toBe(true)   // vinculada: a caixa B também tem
  })
  it('moldura dupla = 2 camadas; o tema com moldura é válido', () => {
    const t = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    criarMoldura(t, { partId: 'p_frente' }, { offsetMm: 2, widthMm: 0.5, dash: null, cornerMm: 0, color: '#ffffff' })
    criarMoldura(t, { partId: 'p_frente' }, { offsetMm: 4, widthMm: 0.5, dash: { onMm: 1.6, offMm: 1 }, cornerMm: 2, color: '#ec4899' })
    expect(t.partContent.p_frente.filter(c => c.type === 'frame')).toHaveLength(2)
    expect(DocTemaZ.safeParse(t).success).toBe(true)
    expect(t.palette).toEqual(['#ec4899', '#ffffff'])
  })
})

// ── Etapa 4 · item 7: cor sólida como preenchimento ─────────────────────────────────────────────────
describe('7 · cor sólida', () => {
  it('cor troca o papel de fundo (como papel), entra na paleta e pinta a face toda', () => {
    const t = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    colocarPapel(t, 'p_frente', vermelho); colocarElemento(t, 'p_frente', flor)
    const id = colocarCor(t, { partId: 'p_frente' }, '#00ff00')
    expect(t.partContent.p_frente[0]).toMatchObject({ id, type: 'solid', color: '#00ff00', anchor: 'paper' })
    expect(t.partContent.p_frente).toHaveLength(2); expect(t.palette[0]).toBe('#00ff00')
    const px = desenhar(t)
    expect(px(16, 16)).toEqual([0, 255, 0]); expect(px(74, 94)).toEqual([0, 255, 0])       // cantos da face A
    expect(px(190, 110)).toEqual([0, 255, 0])                                               // face B (vinculada)
    expect(px(8, 8)).toEqual([255, 255, 255])                                               // fora da face
  })
  it('só nesta caixa; por cima (empilhar); paleta sem repetir', () => {
    const t = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    colocarPapel(t, 'p_frente', vermelho)
    colocarCor(t, { faceId: 'f_b_1' }, '#0000ff')
    expect(t.faceContent.f_b_1[0]).toMatchObject({ type: 'solid', color: '#0000ff' })
    colocarCor(t, { partId: 'p_frente' }, '#123456', true)
    expect(t.partContent.p_frente.map(c => c.type)).toEqual(['image', 'solid'])
    colocarCor(t, { partId: 'p_frente' }, '#0000FF', true)
    expect(t.palette).toEqual(['#0000ff', '#123456'])
    expect(DocTemaZ.safeParse(t).success).toBe(true)
  })
})

// ── Etapa 5 · itens 8 e 9: tamanho do nome, aviso de "passou da face", giro e caixa de transformação ──
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { abrirFonte } from '@/lib/mae/texto/fonte'
import { posicaoEfetiva } from '@/lib/mae/vinculo/resolver'
import { passouDaFace, amostrarContorno, avisoPassou } from '@/lib/mae/texto/limites'
import { escalarPosicao } from '@/lib/mae/editor/posicaoTexto'
import { matrizIdentidade } from '@/components/mae/exportarMae'
import { girarCaminho } from '@/lib/mae/exportar/pdf'
import { anguloFinal, cantosGirados } from '@/components/mae/CaixaTransformavel'
import type { InfoTexto } from '@/lib/mae/texto/noTexto'

describe('8 · tamanho do nome e aviso', () => {
  const slot = { id: 'ts1', variable: 'NOME', faceId: 'f_a_1', box: { x: 0.1, y: 0.4, w: 0.8, h: 0.2 }, single: { lines: 1 as const, sizePt: 28 }, compound: { lines: 2 as const, sizePt: 22 } }
  it('tamanho = tema (todas) × só nesta caixa × pedido; a caixa cresce em volta do centro', () => {
    const t = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    t.textStyles = { NOME: { ...(t.textStyles.NOME ?? {}), sizeScale: 1.5 } as never }
    t.textSlotAdjust = { ts1: { scale: 0.5, rotationDeg: 10, dx: 0.05 } }
    const e = posicaoEfetiva(slot as never, t, { _ESCALA_NOME: '2' })
    expect(e.escala).toBeCloseTo(1.5); expect(e.cfg.single?.sizePt).toBeCloseTo(42); expect(e.cfg.compound?.sizePt).toBeCloseTo(33)
    expect(e.caixa.w).toBeCloseTo(1.2); expect(e.caixa.x + e.caixa.w / 2).toBeCloseTo(0.55)   // centro 0.5 + dx 0.05
    expect(e.rotacaoDeg).toBe(10)
    expect(posicaoEfetiva(slot as never, null).escala).toBe(1)
  })
  it('passou da face: fora ou encostando na linha de corte/dobra; dentro com folga não', () => {
    const face = ret(0, 0, 60, 80)
    expect(passouDaFace(amostrarContorno(cantosGirados(10, 30, 40, 10)), face)).toBe(false)
    expect(passouDaFace(amostrarContorno(cantosGirados(-2, 30, 40, 10)), face)).toBe(true)        // saiu
    expect(passouDaFace(amostrarContorno(cantosGirados(0.1, 30, 40, 10)), face)).toBe(true)       // encostou na linha
    expect(passouDaFace(amostrarContorno(cantosGirados(10, 30, 40, 10, 80)), face)).toBe(false)   // girado, ainda dentro
    expect(avisoPassou('NOME', 'MILK')).toBe('O nome passou da face na caixa MILK, revise')
  })
  it('na folha: nome grande demais vira "revisar" com o aviso; normal não', () => {
    const fonte = abrirFonte(readFileSync(join(process.cwd(), 'public/mae/fontes/Sniglet-Regular.ttf')))
    const d = base(); d.textSlots = [slot]
    const rodar = async (tt: DocTema) => { const f = await fonte; const infos: InfoTexto[] = []; resolverPrancheta(d, 'ab_1', { tema: tt, texto: { fontes: { obter: () => f, substituta: f }, valores: { NOME: 'Maria Júlia' }, aoDiagramar: i => infos.push(i) } }); return infos }
    const t = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    return rodar(t).then(async ok => {
      expect(ok[0].foraDaFace).toBe(false); expect(ok[0].artboardId).toBe('ab_1')
      t.textSlotAdjust = { ts1: { scale: 3.5 } }   // nem em 2 linhas cabe
      const fora = await rodar(t)
      expect(fora[0].foraDaFace).toBe(true); expect(fora[0].revisar).toBe(true)
      expect(fora[0].aviso).toBe('O nome passou da face na caixa a, revise')
    })
  })
})

describe('9 · caixa de transformação', () => {
  it('tamanho mantém a proporção (caixa e fonte juntas, em volta do centro)', () => {
    const s = { box: { x: 0.1, y: 0.4, w: 0.8, h: 0.2 }, single: { sizePt: 28 }, compound: { sizePt: 22 } }
    escalarPosicao(s, 0.5)
    expect(s.box).toEqual({ x: 0.3, y: 0.45, w: 0.4, h: 0.1 }); expect(s.single.sizePt).toBe(14); expect(s.compound.sizePt).toBe(11)
  })
  it('giro com Shift arredonda de 15 em 15; ângulo normalizado', () => {
    expect(anguloFinal(10, 22, true)).toBe(30); expect(anguloFinal(170, 30, false)).toBe(-160)
  })
  it('logo/QR girados: matriz (raster) e caminho (PDF) giram em volta do centro', () => {
    const M = matrizIdentidade({ xMm: 10, yMm: 10, wMm: 20, rotationDeg: 90 }, 2)   // 20 × 10 mm
    const p = (u: number, v: number) => [M[0] * u + M[2] * v + M[4], M[1] * u + M[3] * v + M[5]].map(x => Math.round(x * 1000) / 1000)
    expect(p(0.5, 0.5)).toEqual([20, 15])                       // centro não muda
    expect(p(0, 0)).toEqual([25, 5])                             // canto de cima/esq. girou 90° (horário)
    expect(matrizIdentidade({ xMm: 10, yMm: 10, wMm: 20 }, 2)).toEqual([20, 0, -0, 10, 10, 10])
    expect(girarCaminho('M10 10h20v10h-20Z', 20, 15, 90)).toBe('M25 5L25 25L15 25L15 5Z')
    expect(girarCaminho('M1 1Z', 0, 0, 0)).toBe('M1 1Z')
  })
})

// ── Etapa 6 · itens 10–12: pranchetas livres, orientação e menu rápido ──────────────────────────────
import { fixarPosicoes, posicoesPranchetas, imaPrancheta, organizarPranchetas, girarPrancheta, duplicarPrancheta, excluirPrancheta, moldesForaDaPrancheta, limitesPranchetas } from '@/lib/mae/editor/pranchetas'
import { DocBase } from '@/lib/mae/schema'
import { produce } from 'immer'

describe('10–12 · pranchetas', () => {
  const doisAbs = () => { const d = base(); d.artboards.push({ id: 'ab_2', widthMm: 148, heightMm: 210 }); return d }
  it('sem posição salva = fila antiga; com posição = onde ficou (salva na base)', () => {
    const d = doisAbs()
    expect(posicoesPranchetas(d.artboards)).toEqual([{ xMm: 0, yMm: 0 }, { xMm: 230, yMm: 0 }])
    fixarPosicoes(d); d.artboards[1].xMm = 0; d.artboards[1].yMm = 320     // como a tela faz ao arrastar
    expect(posicoesPranchetas(d.artboards)).toEqual([{ xMm: 0, yMm: 0 }, { xMm: 0, yMm: 320 }])
    expect(limitesPranchetas(d.artboards)).toEqual({ xMm: 0, yMm: 0, wMm: 210, hMm: 530 })
    expect(DocBase.safeParse({ ...d, schemaVersion: 1, type: 'base', id: 'b', version: 1, name: 'b', units: 'mm' }).success).toBe(true)
  })
  it('ímã: encosta na borda/centro das outras e no espaço padrão', () => {
    const outras = [{ xMm: 0, yMm: 0, wMm: 210, hMm: 297 }]
    expect(imaPrancheta({ xMm: 233, yMm: 3 }, 148, 210, outras, 5)).toMatchObject({ xMm: 230, yMm: 0 })    // 20 mm à direita, topo alinhado
    expect(imaPrancheta({ xMm: 2, yMm: 320 }, 148, 210, outras, 5).xMm).toBe(0)                           // esquerda alinhada
    expect(imaPrancheta({ xMm: 500, yMm: 500 }, 148, 210, outras, 5)).toEqual({ xMm: 500, yMm: 500 })     // longe: não mexe
  })
  it('organizar em linha, coluna e grade', () => {
    const d = doisAbs(); d.artboards.push({ id: 'ab_3', widthMm: 105, heightMm: 148 })
    organizarPranchetas(d, 'coluna'); expect(d.artboards.map(a => [a.xMm, a.yMm])).toEqual([[0, 0], [0, 317], [0, 547]])
    organizarPranchetas(d, 'linha'); expect(d.artboards.map(a => [a.xMm, a.yMm])).toEqual([[0, 0], [230, 0], [398, 0]])
    organizarPranchetas(d, 'grade'); expect(d.artboards.map(a => [a.xMm, a.yMm])).toEqual([[0, 0], [230, 0], [0, 317]])
  })
  it('girar troca retrato ↔ paisagem e avisa os moldes que ficaram fora', () => {
    const d = base()
    girarPrancheta(d, 'ab_1')
    expect([d.artboards[0].widthMm, d.artboards[0].heightMm]).toEqual([297, 210])
    expect(moldesForaDaPrancheta(d, 'ab_1')).toEqual([])          // os moldes (até y 130) ainda cabem
    d.artboards[0].heightMm = 100
    expect(moldesForaDaPrancheta(d, 'ab_1')).toEqual(['a', 'b'])
  })
  it('duplicar copia os moldes já vinculados (partes e textos); excluir tira tudo; Ctrl+Z volta', () => {
    const d0 = base(); d0.textSlots = [{ id: 'ts1', variable: 'NOME', faceId: 'f_a_1', box: { x: 0.1, y: 0.4, w: 0.8, h: 0.2 } }]
    let novo = ''
    const d1 = produce(d0, d => { novo = duplicarPrancheta(d, 'ab_1')! })
    expect(d1.artboards).toHaveLength(2); expect(d1.molds).toHaveLength(4)
    const copias = d1.molds.filter(m => m.artboardId === novo)
    expect(new Set(d1.molds.flatMap(m => m.faces.map(f => f.id))).size).toBe(4)                 // ids de face únicos (2 + 2 cópias)
    expect(d1.parts.find(p => p.id === 'p_frente')!.instances).toHaveLength(4)
    expect(d1.textSlots.map(t => t.faceId)).toContain(copias.find(m => m.name === 'a')!.faces[0].id)
    expect(d1.artboards[1].xMm).toBe(230)
    const d2 = produce(d1, d => { excluirPrancheta(d, 'ab_1') })
    expect(d2.artboards.map(a => a.id)).toEqual([novo]); expect(d2.molds).toHaveLength(2)
    expect(d2.parts.find(p => p.id === 'p_frente')!.instances).toHaveLength(2); expect(d2.textSlots).toHaveLength(1)
    expect(produce(d2, d => { expect(excluirPrancheta(d, novo)).toBe(false) }).artboards).toHaveLength(1)   // a última fica
  })
})
