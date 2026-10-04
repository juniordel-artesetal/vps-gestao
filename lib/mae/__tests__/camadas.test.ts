// Operações de camada (Sprint 2) + desfazer/refazer delas + histórico que junta ajustes seguidos.
import { describe, it, expect } from 'vitest'
import { produce } from 'immer'
import {
  acharCamada, agruparCamada, desagruparCamada, duplicarCamada, inserirCamada, listaDoPainel, moverCamada, novaSolida, removerCamada, arquivosDaArvore, novaImagem,
} from '@/lib/mae/editor/camadas'
import { aplicar, criarHistorico, desfazer, refazer } from '@/lib/mae/editor/historico'
import { jsonCanonico } from '@/lib/mae/render'
import { Prancheta, type NoCamada } from '@/lib/mae/schema'

const s = (nome: string) => ({ ...novaSolida({ color: '#000000', xMm: 0, yMm: 0, wMm: 1, hMm: 1 }), name: nome })
const nomes = (l: NoCamada[]) => l.map(n => n.name)
const base = (): NoCamada[] => [s('fundo'), s('meio'), s('topo')]

describe('operações de camada', () => {
  it('inserir acima da selecionada / no topo', () => {
    const l = base()
    inserirCamada(l, s('nova'), l[0].id)
    expect(nomes(l)).toEqual(['fundo', 'nova', 'meio', 'topo'])
    inserirCamada(l, s('no topo'))
    expect(nomes(l).at(-1)).toBe('no topo')
  })
  it('subir/descer respeita as pontas', () => {
    const l = base()
    expect(moverCamada(l, l[2].id, 1)).toBe(false)
    expect(moverCamada(l, l[0].id, 1)).toBe(true)
    expect(nomes(l)).toEqual(['meio', 'fundo', 'topo'])
  })
  it('agrupar e desagrupar devolvem a mesma ordem', () => {
    const l = base()
    const original = nomes(l)
    const g = agruparCamada(l, l[1].id)!
    expect(l[1].type).toBe('group')
    expect(acharCamada(l, l[1].type === 'group' ? l[1].children[0].id : '')?.pai?.id).toBe(g)
    expect(desagruparCamada(l, g)).toBe(true)
    expect(nomes(l)).toEqual(original)
  })
  it('duplicar cria ids novos (inclusive dentro de grupos)', () => {
    const l = base()
    const g = agruparCamada(l, l[2].id)!
    const c = duplicarCamada(l, g)!
    const copia = acharCamada(l, c)!.no
    expect(copia.name).toBe('Grupo cópia')
    const ids = listaDoPainel(l).map(x => x.no.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('remover acha em qualquer nível', () => {
    const l = base()
    const g = agruparCamada(l, l[1].id)!
    const filho = (acharCamada(l, g)!.no as { children: NoCamada[] }).children[0].id
    expect(removerCamada(l, filho)?.name).toBe('meio')
  })
  it('painel lista de cima para baixo, com profundidade', () => {
    const l = base()
    agruparCamada(l, l[2].id, 'G')
    expect(listaDoPainel(l).map(x => `${x.profundidade}:${x.no.name}`)).toEqual(['0:G', '1:topo', '0:meio', '0:fundo'])
  })
  it('arquivos da árvore (para carregar no motor)', () => {
    const l: NoCamada[] = [novaImagem({ path: 'Elementos/a.png', sha256: 'aaaa', xMm: 0, yMm: 0, wMm: 1, hMm: 1 })]
    agruparCamada(l, l[0].id)
    expect([...arquivosDaArvore(l)]).toEqual([['aaaa', 'Elementos/a.png']])
  })
  it('árvore com grupos passa no schema da prancheta', () => {
    const l = base(); agruparCamada(l, l[0].id)
    expect(Prancheta.safeParse({ id: 'p', widthMm: 10, heightMm: 10, layers: l }).success).toBe(true)
  })
})

describe('histórico das camadas', () => {
  it('agrupar → desfazer → refazer volta exatamente', () => {
    const inicio: { layers: NoCamada[] } = { layers: base() }
    let h = criarHistorico(inicio)
    const id = inicio.layers[1].id
    h = aplicar(h, 'Agrupar', d => { agruparCamada(d.layers as NoCamada[], id) })
    const agrupado = h.atual
    h = desfazer(h); expect(h.atual).toEqual(inicio)
    h = refazer(h); expect(h.atual).toEqual(agrupado)
  })
  it('ajustes seguidos com a mesma chave viram 1 passo', () => {
    let h = criarHistorico({ opacidade: 1 })
    for (const v of [0.9, 0.8, 0.7, 0.5]) h = aplicar(h, 'Opacidade', d => { d.opacidade = v }, 'arrasto-1')
    expect(h.desfazer.length).toBe(1)
    h = aplicar(h, 'Opacidade', d => { d.opacidade = 0.2 }, 'arrasto-2')
    expect(h.desfazer.length).toBe(2)
    h = desfazer(h); expect(h.atual.opacidade).toBe(0.5)
    h = desfazer(h); expect(h.atual.opacidade).toBe(1)
    h = refazer(h); expect(h.atual.opacidade).toBe(0.5)
  })
  it('duplicar dentro da receita do Immer (rascunho) funciona', () => {
    const l = base()
    const novo = produce(l, d => { duplicarCamada(d as NoCamada[], l[1].id) })
    expect(nomes(novo)).toEqual(['fundo', 'meio', 'meio cópia', 'topo'])
  })
  it('immer: operação dentro de produce não altera o original', () => {
    const l = base()
    const novo = produce(l, d => { moverCamada(d as NoCamada[], l[0].id, 1) })
    expect(nomes(l)).toEqual(['fundo', 'meio', 'topo'])
    expect(nomes(novo)).toEqual(['meio', 'fundo', 'topo'])
  })
})

describe('receita canônica', () => {
  it('ordem das chaves não muda o JSON', () => {
    expect(jsonCanonico({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: null } })).toBe(jsonCanonico({ a: { c: null, d: [1, { x: 1, y: 2 }] }, b: 1 }))
    expect(jsonCanonico({ a: undefined, b: 1 })).toBe('{"b":1}')
  })
})
