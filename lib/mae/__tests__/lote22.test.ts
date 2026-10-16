// Lote 22 (16/10/2026) — cliente "só MAE".
import { describe, it, expect } from 'vitest'
import { planoDaTela } from '@/lib/mae/pedidos/planoTela'

describe('257 — os botões do "só MAE" nunca somem', () => {
  it('conta só MAE: "mae" mesmo com a consulta falhando, demorando ou respondendo "soa" por erro', () => {
    expect(planoDaTela(true, null)).toBe('mae')       // consulta falhou / ainda carregando
    expect(planoDaTela(true, undefined)).toBe('mae')
    expect(planoDaTela(true, 'soa')).toBe('mae')      // servidor caiu no catch → "soa"
    expect(planoDaTela(true, 'mae')).toBe('mae')
  })
  it('conta SOA completa: igual a antes (começa em "soa"; só muda se a consulta disser "mae")', () => {
    expect(planoDaTela(false, null)).toBe('soa')
    expect(planoDaTela(false, 'soa')).toBe('soa')
    expect(planoDaTela(false, 'mae')).toBe('mae')     // conta avulsa antiga (não standalone) segue funcionando
  })
})

import { itensComQuantidade, qtdValida } from '@/lib/mae/servidor/fontes'
describe('263 — quantidade editável no pedido avulso', () => {
  it('só de 1 a 9999 (inteiro)', () => {
    expect([0, -1, 10000, 'x', null].map(qtdValida)).toEqual([null, null, null, null, null])
    expect([1, '10', 9999, 2.4].map(qtdValida)).toEqual([1, 10, 9999, 2])
  })
  it('troca só o item indicado; os outros ficam como estavam', () => {
    const itens = [{ nome: 'Kit Festa', quantidade: 1, variacao: 'Rosa' }, { nome: 'Tag', quantidade: 5 }]
    expect(itensComQuantidade(itens, [10, null])).toEqual([{ nome: 'Kit Festa', quantidade: 10, variacao: 'Rosa' }, { nome: 'Tag', quantidade: 5 }])
    expect(itensComQuantidade(itens, [3, 3]).map(i => i.quantidade)).toEqual([3, 3])
    expect(itensComQuantidade(null, [1])).toEqual([])
  })
})

import { pedidosDaPlanilha, sugerirMapeamento, canalDe, COLUNAS_MODELO } from '@/lib/mae/pedidos/planilha'
describe('264 — planilha: colunas próprias, modelo genérico e canal', () => {
  it('o modelo é reconhecido sozinho (todas as colunas mapeadas) e TEMA/NOME/IDADE/Canal entram no pedido', () => {
    const m = sugerirMapeamento([...COLUNAS_MODELO])
    expect(m).toMatchObject({ numero: 'Pedido', produto: 'Produto', quantidade: 'Quantidade', tema: 'Tema', nome: 'Nome', idade: 'Idade', dataEnvio: 'Prazo', observacao: 'Observação', canal: 'Canal' })
    const { pedidos } = pedidosDaPlanilha([{ Pedido: '1001', Produto: 'Kit Festa', Quantidade: 10, Tema: 'Moana', Nome: 'Antonella', Idade: '5', Prazo: '25/10/2026', 'Observação': '', Canal: 'zap' }], m)
    expect(pedidos[0]).toMatchObject({ numero: '1001', canal: 'WhatsApp', origem: 'manual', dataEnvio: '2026-10-25', campos: { TEMA: 'Moana', NOME: 'Antonella', IDADE: '5' } })
    expect(pedidos[0].itens).toEqual([{ nome: 'Kit Festa', variacao: null, quantidade: 10 }])
  })
  it('a planilha da Shopee continua igual (canal Shopee, origem shopee, personalização da observação)', () => {
    const cab = ['ID do pedido', 'Nome do Produto', 'Nome da variação', 'Quantidade', 'Observação do comprador']
    const m = sugerirMapeamento(cab)
    expect(m.tema).toBeUndefined(); expect(m.canal).toBeUndefined()
    const { pedidos } = pedidosDaPlanilha([{ 'ID do pedido': 'S1', 'Nome do Produto': 'Tag', 'Nome da variação': 'Rosa,10', Quantidade: 1, 'Observação do comprador': 'Tema: Sereia. Ana 3 anos' }], m)
    expect(pedidos[0]).toMatchObject({ canal: 'Shopee', origem: 'shopee', campos: { TEMA: 'Sereia', NOME: 'Ana', IDADE: '3' } })
    expect(pedidos[0].itens[0].quantidade).toBe(10)
  })
  it('canal escolhido na importação vale quando a planilha não tem a coluna; a coluna vale mais', () => {
    const m = { numero: 'P', produto: 'X' }
    expect(pedidosDaPlanilha([{ P: '7', X: 'Kit' }], m, 'Elo7').pedidos[0].canal).toBe('Elo7')
    expect(['elo 7', 'Shopee BR', 'site', 'Instagram', ''].map(canalDe)).toEqual(['Elo7', 'Shopee', 'Site', 'Instagram', null])
  })
  it('coluna própria vale mais que a observação', () => {
    const m = sugerirMapeamento(['Pedido', 'Produto', 'Nome', 'Observação'])
    expect(pedidosDaPlanilha([{ Pedido: '9', Produto: 'Kit', Nome: 'Luísa', 'Observação': 'Ana 5 anos' }], m).pedidos[0].campos.NOME).toBe('Luísa')
  })
})

import { unificarModelos, ordenarLote } from '@/lib/mae/pedidos/ordemLote'
describe('260 — "a mesma caixa junta" com tema pronto (marca no PDF)', () => {
  const b = (pedido: string, tema: string, modelo: string, caixa: string, indice: number) => ({ pedido, tema, modelo, caixa, indice })
  it('caso da Naty: Ariel (com marca) + Benício/Heróis (tema pronto, sem marca) → as pirâmides e as maletas saem juntas', () => {
    const blocos = [
      b('ariel', 'Ariel', 'mr:sha-piramide', 'piramide', 0), b('ariel', 'Ariel', 'mr:sha-maleta', 'maleta', 1),
      b('benicio', 'Heróis', 'n:piramide', 'piramide', 0), b('benicio', 'Heróis', 'n:maleta', 'maleta', 1),
    ]
    const { blocos: un, avisos } = unificarModelos(blocos)
    expect(avisos).toEqual([])
    expect(ordenarLote(un, 'modelo', false).map(x => `${x.pedido}:${x.caixa}`)).toEqual(['ariel:piramide', 'benicio:piramide', 'ariel:maleta', 'benicio:maleta'])
  })
  it('a mesma caixa com duas marcas diferentes de verdade (outra máquina): não junta e avisa no resumo', () => {
    const blocos = [b('ariel', 'Ariel', 'mr:a', 'piramide', 0), b('benicio', 'Heróis', 'mr:b', 'piramide', 0)]
    const { blocos: un, avisos } = unificarModelos(blocos, id => (id === 'ariel' ? 'Ariel' : 'Heróis'))
    expect(un.map(x => x.modelo)).toEqual(['mr:a', 'mr:b'])
    expect(avisos[0]).toMatch(/2 grupos de marca na caixa PIRAMIDE: Ariel e Heróis não ficam juntos/)
  })
  it('sem marca em lugar nenhum: igual a antes (pelo nome)', () => {
    const blocos = [b('x', 'T', 'n:cubo', 'cubo', 0), b('y', 'U', 'n:cubo', 'cubo', 0)]
    expect(unificarModelos(blocos).blocos.map(x => x.modelo)).toEqual(['n:cubo', 'n:cubo'])
  })
})
