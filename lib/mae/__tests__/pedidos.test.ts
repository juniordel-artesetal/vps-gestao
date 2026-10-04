// Sprint 12 — PEDIDOS, MASSA e LOJA (parte pura): campos TEMA/NOME/IDADE, variáveis e hashtag, tema do
// pedido (vínculo variação → produto → campo TEMA), fila de geração com progresso, status do card e o
// pack da Naty encaixando na base pelo nome das partes.
import { describe, it, expect } from 'vitest'
import { camposDoPedido, faltando, variaveis, acharTema, rodarFila, resumo, statusDoCard, alertasDaLinha, pastaDoPedido } from '@/lib/mae/pedidos/pedidos'
import { aplicarPack, avisosDoPack, arquivosDoTema, caminhoNoPack } from '@/lib/mae/pedidos/loja'
import { DocTema } from '@/lib/mae/schema'

describe('campos e variáveis do pedido', () => {
  it('TEMA/NOME/IDADE (sem acento/maiúscula; aliases antigos) + extras em MAIÚSCULAS', () => {
    const c = camposDoPedido({ 'Tema': 'Fazendinha', 'Nome da Criança': 'Maria Júlia', 'idade': '1', 'Frase': 'Que alegria', 'Vazio': ' ' })
    expect(c).toEqual({ TEMA: 'Fazendinha', NOME: 'Maria Júlia', IDADE: '1', extras: { FRASE: 'Que alegria' } })
    expect(faltando(c)).toEqual([])
    expect(faltando(camposDoPedido({ Nome: 'Ana' }))).toEqual(['TEMA', 'IDADE'])
  })
  it('HASHTAG da spec (#MariaJúliafaz1), com o texto do meio do tema; editadas vencem', () => {
    const c = camposDoPedido({ Tema: 'X', Nome: 'Maria Júlia', Idade: '1' })
    expect(variaveis(c).HASHTAG).toBe('#MariaJúliafaz1')
    expect(variaveis(c, 'completa').HASHTAG).toBe('#MariaJúliacompleta1')
    const e = variaveis(c, 'faz', { NOME: 'Maria', HASHTAG: '' })
    expect(e.NOME).toBe('Maria'); expect(e.HASHTAG).toBe('#Mariafaz1')
    expect(variaveis(c, 'faz', { HASHTAG: '#OutraCoisa' }).HASHTAG).toBe('#OutraCoisa')
  })
  it('pasta do pedido no lote', () => {
    expect(pastaDoPedido('Exportações/2026-10-04', '#1023', 'Maria Júlia')).toBe('Exportações/2026-10-04/1023_Maria-Julia')
  })
})

describe('tema do pedido', () => {
  const temas = [{ id: 't1', name: 'Fazendinha Rosa', version: 3 }, { id: 't2', name: 'Stitch', version: 1 }]
  const vinc = [{ produtoId: 'p1', variacaoId: 'v1', themeId: 't2' }, { produtoId: 'p2', variacaoId: null, themeId: 't1' }]
  it('vínculo da VARIAÇÃO > vínculo do PRODUTO > campo TEMA', () => {
    expect(acharTema([{ variacaoId: 'v1', produtoId: 'p1' }], vinc, temas, 'Fazendinha Rosa')).toEqual({ themeId: 't2', origem: 'variacao' })
    expect(acharTema([{ variacaoId: 'v9', produtoId: 'p2' }], vinc, temas, 'Stitch')).toEqual({ themeId: 't1', origem: 'produto' })
    expect(acharTema([{ variacaoId: 'v9', produtoId: 'p9' }], vinc, temas, '  fazendinha   ROSA ')).toEqual({ themeId: 't1', origem: 'campo' })
    expect(acharTema([], vinc, temas, 'Inexistente')).toBeNull()
  })
  it('vínculo para tema que não existe mais é ignorado', () => {
    expect(acharTema([{ variacaoId: 'v1' }], [{ produtoId: 'p', variacaoId: 'v1', themeId: 'apagado' }], temas, 'Stitch')).toEqual({ themeId: 't2', origem: 'campo' })
  })
  it('alertas da linha', () => {
    expect(alertasDaLinha(camposDoPedido({ Nome: 'Ana' }), null)).toEqual(['faltam dados (TEMA, IDADE)', 'tema não encontrado'])
    expect(alertasDaLinha(camposDoPedido({ Tema: 'x', Nome: 'Maximiliana Valentina', Idade: '2' }), { themeId: 't', origem: 'campo' })).toEqual(['nome longo'])
    expect(alertasDaLinha(camposDoPedido({ Nome: 'Ana', Idade: '2' }), { themeId: 't', origem: 'variacao' })).toEqual([])   // tema veio do vínculo
  })
})

describe('fila de geração', () => {
  it('um por vez, na ordem, com progresso; erro não para a fila; avisos viram "com aviso"', async () => {
    const ordem: string[] = [], prog: number[] = []
    const itens = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}` }))
    let ativos = 0, maxAtivos = 0
    const r = await rodarFila(itens, async (it, i) => {
      ativos++; maxAtivos = Math.max(maxAtivos, ativos)
      await new Promise(res => setTimeout(res, 1))
      ordem.push(it.id); ativos--
      if (i === 5) throw new Error('arquivo faltando')
      return { valor: `${it.id}.pdf`, avisos: i === 7 ? ['nome longo'] : [] }
    }, { aoProgredir: f => prog.push(f) })
    expect(maxAtivos).toBe(1)
    expect(ordem).toEqual(itens.map(i => i.id))
    expect(resumo(r)).toEqual({ gerada: 18, aviso: 1, erro: 1 })
    expect(r[5]).toMatchObject({ status: 'erro', mensagem: 'arquivo faltando' })
    expect(prog.at(-1)).toBe(20)
  })
  it('cancelar para depois do item atual', async () => {
    let n = 0
    const r = await rodarFila(Array.from({ length: 10 }, (_, i) => ({ id: `${i}` })), async () => { n++; return { valor: 1 } }, { cancelado: () => n >= 3 })
    expect(r.length).toBe(3)
  })
})

describe('status do card', () => {
  it('não gerada → gerada (último registro) e histórico mantido', () => {
    expect(statusDoCard([]).status).toBe('nao_gerada')
    const h = [
      { status: 'gerada', arquivo: 'a.pdf', themeId: 't', themeVersion: 1, criadoEm: '2026-10-04T10:00:00Z' },
      { status: 'revisar', arquivo: 'b.pdf', themeId: 't', themeVersion: 2, criadoEm: '2026-10-04T11:00:00Z' },
    ]
    expect(statusDoCard(h).status).toBe('revisar')
    expect(statusDoCard([...h, { status: 'gerada', arquivo: 'c.pdf', themeId: 't', themeVersion: 2, criadoEm: '2026-10-04T12:00:00Z' }])).toMatchObject({ status: 'gerada', ultima: { arquivo: 'c.pdf' } })
    expect(statusDoCard(h).historico.length).toBe(2)
  })
})

describe('pack da Loja da Naty', () => {
  const pack = DocTema.parse({ schemaVersion: 1, type: 'theme', id: 'naty_stitch', version: 2, name: 'Stitch Havaí', baseId: 'base_naty', baseVersion: 4,
    overflowFill: { path: 'Papéis/stitch/hibisco.png', sha256: 'abcd' },
    partContent: { pn_frente: [{ id: 'l1', type: 'image', anchor: 'paper', path: 'Papéis/stitch/praia.png', sha256: 'aaaa' }], pn_fundo: [{ id: 'l2', type: 'image', anchor: 'paper', path: 'Papéis/stitch/folha.png', sha256: 'bbbb' }], pn_tampa: [] },
    localOverrides: { f_x: { l1: { transform: { x: 0.3 } } } } })
  const info = { partes: { pn_frente: 'FRENTE', pn_fundo: 'Fundo', pn_tampa: 'TAMPA' }, arquivos: [], precoCentavos: null }
  const base = { id: 'base_aluna', version: 7, parts: [{ id: 'p_a', name: 'FRENTE', instances: [1] }, { id: 'p_b', name: 'FUNDO', instances: [1] }, { id: 'p_c', name: 'ALÇA', instances: [1] }, { id: 'p_d', name: 'LATERAL', instances: [] }] }
  it('encaixa pelo NOME da parte, move os arquivos para Packs Naty/ e avisa o que falta', () => {
    const r = aplicarPack(pack, info, base, 'th_novo')
    expect(Object.keys(r.tema.partContent).sort()).toEqual(['p_a', 'p_b'])
    expect((r.tema.partContent.p_a[0] as { path: string }).path).toBe('Packs Naty/Stitch-Havai/Papéis/stitch/praia.png')
    expect(r.tema.overflowFill?.path).toBe(caminhoNoPack('Stitch Havaí', 'Papéis/stitch/hibisco.png'))
    expect(r.tema).toMatchObject({ id: 'th_novo', version: 1, baseId: 'base_aluna', baseVersion: 7, localOverrides: {} })
    expect(avisosDoPack(r.semConteudo)).toEqual(['o pack não tem ALÇA, escolha um papel'])
    expect(r.naoUsadas).toEqual(['TAMPA'])
  })
  it('arquivos do tema (para publicar)', () => {
    expect(arquivosDoTema(pack).sort()).toEqual(['Papéis/stitch/folha.png', 'Papéis/stitch/hibisco.png', 'Papéis/stitch/praia.png'])
  })
})
