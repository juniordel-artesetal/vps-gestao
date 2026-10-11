// Lote 7 — pedidos, impressão e produção (11/10/2026): plano avulso × SOA (120), ajustes do pedido iguais nas duas
// fontes, filtros/urgência (116), ordem e divisão do lote (117/118), etapa de impressão (119) e planilha (121).
import { describe, it, expect } from 'vitest'
import { planoDe, ehPedidoMae } from '@/lib/mae/servidor/plano'
import { aplicarAjustes, ajustesParaTela, temaValido } from '@/lib/mae/servidor/ajustesPedido'
import { sanearNovoPedido } from '@/lib/mae/servidor/fontes'
import { filtrar, ordenarPorUrgencia, situacaoPrazo, opcoesDosFiltros, guardarFiltro, lerFiltrosSalvos, nFiltros, type Filtravel } from '@/lib/mae/pedidos/filtros'
import { ordenarLote, intercalar, dividirEmPartes, nomeDoLote, lugarDoRotulo, type BlocoLote } from '@/lib/mae/pedidos/ordemLote'
import { acharEtapaImpressao, type SetorFluxo } from '@/lib/producao/etapaImpressao'
import { sugerirMapeamento, pedidosDaPlanilha, dataDaPlanilha, personalizacaoDaObs, mapeamentoCompleto } from '@/lib/mae/pedidos/planilha'

describe('120 — plano e fontes', () => {
  it('só MAE = env de teste ou compra do avulso; senão SOA completo', () => {
    expect(planoDe('ws1', 'ws1,ws2', false)).toBe('mae')
    expect(planoDe('ws3', 'ws1', true)).toBe('mae')
    expect(planoDe('ws3', '', false)).toBe('soa')
    expect(planoDe('ws3', undefined, false)).toBe('soa')
    expect(ehPedidoMae('mo_abc')).toBe(true); expect(ehPedidoMae('cmabc')).toBe(false)
  })
  it('ajustes do pedido: mesma regra nas duas fontes (null tira, "*" tira todas as posições)', () => {
    const a = aplicarAjustes({}, { escalas: { NOME: 1.2 }, temaId: 'th_1', posicoes: { s1: { dx: 0.1 } }, divisaoNome: 2 })
    expect(ajustesParaTela(a)).toMatchObject({ escalas: { NOME: 1.2 }, temaId: 'th_1', posicoes: { s1: { dx: 0.1 } }, divisaoNome: 2 })
    const b = aplicarAjustes(a, { escalas: { NOME: null }, temaId: null, posicoes: { '*': null } })
    expect(ajustesParaTela(b)).toMatchObject({ escalas: {}, temaId: null, posicoes: {} })
    expect(temaValido('th_x')).toBe('th_x'); expect(temaValido(null)).toBeNull(); expect(temaValido('a b')).toBeUndefined()
  })
  it('cadastro manual: precisa de nº e produto; campos em maiúsculas; quantidade mínima 1', () => {
    expect(sanearNovoPedido({ numero: '', itens: [{ nome: 'Kit' }] })).toBeNull()
    expect(sanearNovoPedido({ numero: '12', itens: [] })).toBeNull()
    const p = sanearNovoPedido({ origem: 'manual', numero: ' 12 ', itens: [{ nome: 'Kit Festa', quantidade: 0 }], campos: { nome: 'Ana', Tema: 'Moana' }, dataEnvio: '2026-10-12' })!
    expect(p).toMatchObject({ origem: 'manual', numero: '12', itens: [{ nome: 'Kit Festa', quantidade: 1 }], campos: { NOME: 'Ana', TEMA: 'Moana' }, dataEnvio: '2026-10-12' })
  })
})

const f = (o: Partial<Filtravel>): Filtravel => ({ numero: '1', cliente: '', nome: '', temaSoa: '', temaMae: '', produto: '', status: '', canal: '', loja: '', dataEnvio: '', temTema: true, comObs: false, ajustado: false, ...o })

describe('116 — busca, filtros e urgência', () => {
  const hoje = '2026-10-11'
  const ls = [
    f({ numero: '101', cliente: 'Maria', nome: 'Ana', temaSoa: 'Mickey Safari', produto: 'Kit Festa', canal: 'Shopee', loja: 'Artes e Tal', dataEnvio: '2026-10-11' }),
    f({ numero: '102', cliente: 'João', nome: 'Bento', temaSoa: 'Moana', produto: 'Tag', canal: 'Shopee', dataEnvio: '2026-10-09', comObs: true }),
    f({ numero: '103', cliente: 'Carla', nome: 'Cauã', temaSoa: 'Mickey Safari', produto: 'Kit Festa', canal: 'Loja', dataEnvio: '2026-10-12', temTema: false, ajustado: true }),
    f({ numero: '104', cliente: 'Zé', nome: 'Léo', temaSoa: '', produto: 'Kit Festa', canal: 'Direta' }),
  ]
  const ids = (xs: Filtravel[]) => xs.map(x => x.numero)
  it('busca única: nº, cliente, aniversariante e tema, sem acento', () => {
    expect(ids(filtrar(ls, { busca: '#102' }, x => x, hoje))).toEqual(['102'])
    expect(ids(filtrar(ls, { busca: 'caua' }, x => x, hoje))).toEqual(['103'])
    expect(ids(filtrar(ls, { busca: 'mickey safari' }, x => x, hoje))).toEqual(['101', '103'])
  })
  it('chips combináveis: E entre categorias, OU dentro', () => {
    expect(ids(filtrar(ls, { temas: ['Mickey Safari'], canais: ['Shopee'] }, x => x, hoje))).toEqual(['101'])
    expect(ids(filtrar(ls, { canais: ['Shopee', 'Loja'] }, x => x, hoje))).toEqual(['101', '102', '103'])
    expect(ids(filtrar(ls, { lojas: ['artes e tal'] }, x => x, hoje))).toEqual(['101'])
    expect(ids(filtrar(ls, { semTema: true }, x => x, hoje))).toEqual(['103'])
    expect(ids(filtrar(ls, { comObs: true }, x => x, hoje))).toEqual(['102'])
    expect(ids(filtrar(ls, { ajustado: true }, x => x, hoje))).toEqual(['103'])
  })
  it('prazo: despacha hoje / até amanhã / atrasados; ordem do mais urgente', () => {
    expect(ids(filtrar(ls, { prazo: 'hoje' }, x => x, hoje))).toEqual(['101'])
    expect(ids(filtrar(ls, { prazo: 'atrasados' }, x => x, hoje))).toEqual(['102'])
    expect(ids(filtrar(ls, { prazo: 'amanha' }, x => x, hoje))).toEqual(['101', '102', '103'])
    expect(situacaoPrazo('', hoje)).toBe('sem')
    expect(ids(ordenarPorUrgencia(ls, x => x))).toEqual(['102', '101', '103', '104'])
  })
  it('opções dos chips e filtros salvos', () => {
    expect(opcoesDosFiltros(ls).temas).toEqual(['Mickey Safari', 'Moana'])
    expect(opcoesDosFiltros(ls).canais).toEqual(['Direta', 'Loja', 'Shopee'])
    const s = guardarFiltro(guardarFiltro([], 'Hoje – Shopee', { prazo: 'hoje', canais: ['Shopee'] }), 'hoje – shopee', { prazo: 'hoje' })
    expect(s.length).toBe(1); expect(s[0].filtros).toEqual({ prazo: 'hoje' })
    expect(lerFiltrosSalvos(JSON.stringify(s))).toEqual(s); expect(lerFiltrosSalvos('lixo')).toEqual([])
    expect(nFiltros({ busca: ' a ', temas: ['x', 'y'], prazo: 'hoje' })).toBe(4)
  })
})

describe('117/118 — lote de impressão: ordem, intercalar, divisão, nome e identificação', () => {
  const b = (pedido: string, tema: string, modelo: string, indice: number): BlocoLote & { id: string } => ({ pedido, tema, modelo, indice, id: `${pedido}:${modelo}:${indice}` })
  const blocos = [
    b('ana', 'Moana', 'MILK', 0), b('ana', 'Moana', 'MILK', 1), b('ana', 'Moana', 'CUBO', 2),
    b('bia', 'Moana', 'MILK', 0), b('bia', 'Moana', 'CUBO', 1),
    b('bento', 'Safari', 'MILK', 0), b('bento', 'Safari', 'CUBO', 1),
    b('caio', 'Safari', 'MILK', 0), b('caio', 'Safari', 'CUBO', 1),
  ]
  it('por pedido: o kit de cada cliente junto', () => {
    expect(ordenarLote(blocos, 'pedido').map(x => x.pedido)).toEqual(['ana', 'ana', 'ana', 'bia', 'bia', 'bento', 'bento', 'caio', 'caio'])
  })
  it('por modelo + intercalar: Moana (Ana) → Safari (Bento) → Moana (Bia) → Safari (Caio); cópias da Ana juntas', () => {
    const r = ordenarLote(blocos, 'modelo', true)
    expect(r.filter(x => x.modelo === 'MILK').map(x => x.pedido)).toEqual(['ana', 'ana', 'bento', 'bia', 'caio'])
    expect(r.filter(x => x.modelo === 'CUBO').map(x => x.pedido)).toEqual(['ana', 'bento', 'bia', 'caio'])
    expect(r.slice(0, 5).every(x => x.modelo === 'MILK')).toBe(true)
  })
  it('sem intercalar, ou todos do mesmo tema: a ordem normal, sem erro', () => {
    expect(ordenarLote(blocos, 'modelo', false).filter(x => x.modelo === 'MILK').map(x => x.pedido)).toEqual(['ana', 'ana', 'bia', 'bento', 'caio'])
    const iguais = [{ tema: 'A', n: 1 }, { tema: 'A', n: 2 }, { tema: 'A', n: 3 }]
    expect(intercalar(iguais).map(x => x.n)).toEqual([1, 2, 3])
    expect(intercalar([{ tema: 'A', n: 1 }, { tema: 'A', n: 2 }, { tema: 'B', n: 3 }]).map(x => x.tema)).toEqual(['A', 'B', 'A'])
  })
  it('divisão em arquivos de até 10 pedidos e o nome LOTE_data_produto_1de3_Npag', () => {
    expect(dividirEmPartes([...Array(23).keys()], 10).map(p => p.length)).toEqual([10, 10, 3])
    expect(dividirEmPartes([1, 2], 0).length).toBe(1)
    expect(nomeDoLote({ data: new Date(2026, 9, 11), produto: 'Kit Festa', parte: 1, partes: 3, paginas: 48 })).toBe('LOTE_2026-10-11_Kit-Festa_1de3_48pag')
    expect(nomeDoLote({ data: new Date(2026, 9, 11), produto: 'Tag Cofrinho', parte: 1, partes: 1, paginas: 6 })).toBe('LOTE_2026-10-11_Tag-Cofrinho_6pag')
  })
  it('"#123 · Naty" na margem com mais espaço, fora da sangria; sem espaço não imprime', () => {
    const r = lugarDoRotulo(210, 297, [{ x: 20, y: 10, w: 160, h: 270 }])!
    expect(r.vertical).toBe(true); expect(r.xMm).toBeLessThan(20)
    const baixo = lugarDoRotulo(210, 297, [{ x: 2, y: 2, w: 206, h: 250 }])!
    expect(baixo.vertical).toBe(false); expect(baixo.yMm).toBeGreaterThan(252)
    expect(lugarDoRotulo(210, 297, [{ x: 1, y: 1, w: 208, h: 295 }])).toBeNull()
  })
})

describe('119 — etapa de impressão pelo TIPO (nome só como reserva)', () => {
  const s = (id: string, nome: string, o: Partial<SetorFluxo> = {}): SetorFluxo => ({ id, nome, ordem: 0, ehExpedicao: false, tipo: null, ...o })
  it('pelo tipo, qualquer nome; sem tipo marcado, pelo nome; a Expedição nunca é a de impressão', () => {
    expect(acharEtapaImpressao([s('a', 'Arte'), s('b', 'Imprimir', { tipo: 'impressao' }), s('c', 'Impressão')])?.id).toBe('b')
    expect(acharEtapaImpressao([s('a', 'Arte'), s('c', 'Impressão'), s('e', 'Expedição', { ehExpedicao: true })])?.id).toBe('c')
    expect(acharEtapaImpressao([s('a', 'Arte'), s('x', 'Imprimir e expedir', { ehExpedicao: true })])).toBeNull()
    expect(acharEtapaImpressao([s('a', 'Corte'), s('b', 'Montagem')])).toBeNull()
  })
})

describe('121 — planilha da Shopee', () => {
  const cab = ['ID do pedido', 'Nome do Produto', 'Nome da variação', 'Quantidade', 'Data prevista de envio', 'Observação do comprador', 'Nome do destinatário', 'Outra']
  it('mapeamento sugerido pelo cabeçalho da Shopee; o salvo vale se a coluna existe', () => {
    const m = sugerirMapeamento(cab)
    expect(m).toMatchObject({ numero: 'ID do pedido', produto: 'Nome do Produto', variacao: 'Nome da variação', dataEnvio: 'Data prevista de envio', cliente: 'Nome do destinatário' })
    expect(mapeamentoCompleto(m)).toBe(true)
    expect(sugerirMapeamento(cab, { cliente: 'Outra' }).cliente).toBe('Outra')
    expect(sugerirMapeamento(cab, { cliente: 'Sumiu' }).cliente).toBe('Nome do destinatário')
    expect(mapeamentoCompleto(sugerirMapeamento(['x', 'y']))).toBe(false)
  })
  it('linhas com o mesmo nº = 1 pedido; "Variação,10" = 10 peças; datas da Shopee e do Excel', () => {
    const m = sugerirMapeamento(cab)
    const { pedidos, ignoradas } = pedidosDaPlanilha([
      { 'ID do pedido': '2610AAA', 'Nome do Produto': 'Kit Festa', 'Nome da variação': 'Moana,10', 'Quantidade': '1', 'Data prevista de envio': '2026-10-13 23:59', 'Observação do comprador': 'Tema: Moana. Ana 5 anos', 'Nome do destinatário': 'Maria' },
      { 'ID do pedido': '2610AAA', 'Nome do Produto': 'Tag', 'Nome da variação': '', 'Quantidade': '2' },
      { 'ID do pedido': '', 'Nome do Produto': 'x' },
    ], m)
    expect(ignoradas).toBe(1); expect(pedidos.length).toBe(1)
    expect(pedidos[0]).toMatchObject({ numero: '2610AAA', cliente: 'Maria', dataEnvio: '2026-10-13', itens: [{ nome: 'Kit Festa', variacao: 'Moana', quantidade: 10 }, { nome: 'Tag', variacao: null, quantidade: 2 }] })
    expect(pedidos[0].campos).toEqual({ TEMA: 'Moana', NOME: 'Ana', IDADE: '5' })
    expect(dataDaPlanilha('11/10/2026')).toBe('2026-10-11'); expect(dataDaPlanilha(46306)).toBe('2026-10-11'); expect(dataDaPlanilha('amanhã')).toBeNull()
  })
  it('observação ambígua não chuta (fica para completar na lista)', () => {
    expect(personalizacaoDaObs('Ana 5 anos e Bia 3 anos')).toEqual({})
    expect(personalizacaoDaObs('')).toEqual({})
  })
})
