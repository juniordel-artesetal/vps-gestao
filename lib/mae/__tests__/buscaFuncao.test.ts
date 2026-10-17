// Lote 21 (item 256): busca de função — o jeito que a artesã fala → o controle certo.
import { describe, it, expect } from 'vitest'
import { buscarFuncao, CONTROLES } from '@/lib/mae/editor/buscaFuncao'

const TEMA = ['papeis', 'elementos', 'cor', 'partes', 'texto', 'moldurinha', 'transicao', 'formas', 'exportar', 'pronto'].map(id => ({ id, nome: id === 'formas' ? 'Formas' : id === 'exportar' ? 'Exportar' : id, frase: id === 'exportar' ? 'Arte pra aprovação e arquivo pra impressão.' : '' }))
const BASE = [{ id: 'passo-1', nome: 'Moldes', frase: 'Importe os moldes (PDF, SVG).', passo: 1 }, { id: 'passo-9', nome: 'Salvar', frase: 'Dê nome e salve a base.', passo: 9 }]

describe('buscarFuncao', () => {
  it.each([
    ['acento', '[data-montar-acentos-caixa]'],
    ['contorno', '[data-add-efeito]'],
    ['laço', '[data-abrir-enfeite]'],
    ['laco', '[data-abrir-enfeite]'],
    ['2 linhas', '[data-modo-nome]'],
    ['moldurinha', '[data-painel-molduras]'],
    ['pincel', '[data-abrir-cheia]'],
    ['FAIXA', '[data-fundo-texto]'],
  ])('"%s" acha o controle certo em 1º', (q, alvo) => {
    expect(buscarFuncao(q, TEMA, 'tema')[0]?.alvo).toBe(alvo)
  })
  it('acha a função da barra pelo nome e pela frase', () => {
    expect(buscarFuncao('impressão', TEMA, 'tema').some(r => r.funcao === 'exportar')).toBe(true)
    expect(buscarFuncao('formas', TEMA, 'tema')[0].funcao).toBe('formas')
  })
  it('na Base só aparecem as coisas da Base (com o passo)', () => {
    const r = buscarFuncao('moldes', BASE, 'base')
    expect(r[0]).toMatchObject({ funcao: 'passo-1', passo: 1 })
    expect(buscarFuncao('contorno', BASE, 'base')).toEqual([])
  })
  it('menos de 2 letras ou nada a ver: vazio', () => {
    expect(buscarFuncao('a', TEMA, 'tema')).toEqual([])
    expect(buscarFuncao('xyzw', TEMA, 'tema')).toEqual([])
  })
  it('todo controle do índice aponta para uma função que existe no Tema', () => {
    for (const c of CONTROLES) expect(TEMA.some(f => f.id === c.funcao)).toBe(true)
  })
})
