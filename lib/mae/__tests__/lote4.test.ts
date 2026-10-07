// Lote 4 (reteste da Naty, 06/10/2026) — itens 38 a 52 e pendências do reteste (21, 29, 30, 34).
import { describe, it, expect } from 'vitest'
import { separarNomeIdade, camposDoPedido, acharTema, alvosDoPedido, alertasDaLinha, pastaDoProduto, campoParaGravar, chaveProduto, chaveProdutoTema } from '@/lib/mae/pedidos/pedidos'
import { nomeTemaPronto, parteArquivo } from '@/lib/mae/exportar/nomes'
import { montarTemaPronto, produtoDoCaminho } from '@/lib/mae/temasProntos/montar'
import { resolverPrancheta, ehAplique } from '@/lib/mae/vinculo/resolver'
import { atribuirFace, garantirPartesPadrao } from '@/lib/mae/vinculo/partes'
import { colocarElemento, novoTema } from '@/lib/mae/vinculo/tema'
import { facesParaReceita } from '@/lib/mae/editor/moldes'
import { novoDocumento } from '@/lib/mae/schema/documento'
import { DocTema, type DocTrabalho } from '@/lib/mae/schema'
import type { Pt } from '@/lib/mae/faces/geometria'

// ── 44 · NOME e IDADE separados ──────────────────────────────────────────────────────────────────
describe('44 · separar o campo único "nome e idade"', () => {
  it('formatos reais da equipe da Naty', () => {
    const casos: [string, string, string | undefined][] = [
      ['Isabella Costa 2 anos', 'Isabella Costa', '2'],
      ['Tiago - 6 anos', 'Tiago', '6'],
      ['João Alberto, 5 anos', 'João Alberto', '5'],
      ['Nome: Liz\n Idade: 6 anos -', 'Liz', '6'],
      ['Nome : José Sérgio \n 06 anos', 'José Sérgio', '6'],
      ['Nome: Maria Isabella, 1 Aninho', 'Maria Isabella', '1'],
      ['Davi e a idade é 2 anos.', 'Davi', '2'],
      ['Nome ana cecilia 4 anos', 'ana cecilia', '4'],
      ['NOME DA CRIANÇA: ANA LIZ \n IDADE DA CRIANÇA: 2 ANOS', 'ANA LIZ', '2'],
      ['Heloísa idade 01 ano', 'Heloísa', '1'],
      ['Liz 1Ano', 'Liz', '1'],
      ['Cecília', 'Cecília', undefined],
    ]
    for (const [txt, nome, idade] of casos) expect(separarNomeIdade(txt), txt).toEqual({ nome, ...(idade ? { idade } : {}), revisar: false })
  })
  it('na dúvida vai para "revisar" e não chuta', () => {
    for (const txt of ['PEDI O NOME', 'pedi o nome', 'Elisa 2 aninhos \n Heloísa 8 anos', 'Martina 7 meses', 'arte da cliente - branca de neve - maria flor',
      'Guilherme e ele vai fazer 1 ano', 'Kit 01: Kit com 12 sem laço COR ROSA\n Nome: Maria Cecília \n Idade: 2 anos', 'RAVI 1 ano & AYDAM', 'boa noite. nome: Ana Clara. idade: 02 anos']) {
      expect(separarNomeIdade(txt).revisar, txt).toBe(true)
    }
    expect(separarNomeIdade('   ')).toEqual({ revisar: false })
  })
  it('camposDoPedido: "Nome e Idade" vira NOME/IDADE; os campos separados vencem; o duvidoso fica para revisar', () => {
    const c = camposDoPedido({ Tema: 'SONIC - KIT', 'Nome e Idade': 'Isabella Costa 2 anos', 'Variação': 'LAÇO SIMPLES,36' })
    expect([c.TEMA, c.NOME, c.IDADE]).toEqual(['SONIC - KIT', 'Isabella Costa', '2'])
    expect(c.extras).toEqual({ 'VARIAÇÃO': 'LAÇO SIMPLES,36' })        // o campo único não vira variável extra
    const migrado = camposDoPedido({ 'Nome e Idade': 'Isa 2 anos', Nome: 'Isabella', Idade: '3' })
    expect([migrado.NOME, migrado.IDADE]).toEqual(['Isabella', '3'])
    const duvida = camposDoPedido({ Tema: 'X', 'Nome e Idade': 'PEDI O NOME' })
    expect(duvida.NOME).toBeUndefined()
    expect(duvida.revisarNomeIdade).toBe('PEDI O NOME')
    expect(alertasDaLinha(duvida, { themeId: 't', origem: 'campo' })).toContain('revisar nome e idade')
    expect(alertasDaLinha(duvida, { themeId: 't', origem: 'campo' }, { NOME: 'Ana' })).not.toContain('revisar nome e idade')
  })
  it('grava no campo que o ateliê usa', () => {
    expect(campoParaGravar('NOME', ['Tema', 'Nome e Idade', 'Nome', 'Idade'])).toBe('Nome')
    expect(campoParaGravar('NOME', ['Tema', 'Nome e Idade'], ['Nome da criança'])).toBe('Nome da criança')
    expect(campoParaGravar('IDADE', [])).toBe('Idade')
    expect(campoParaGravar('TEMA', ['Tema da festa'])).toBe('Tema da festa')
  })
})

describe('44 · a arte certa é PRODUTO + TEMA', () => {
  const temas = [
    { id: 'kit_urs', name: 'Ursinha', version: 1, produto: 'Kit Festa' },
    { id: 'sac_urs', name: 'Ursinha', version: 1, produto: 'Sacola P' },
    { id: 'sereia', name: 'Sereia', version: 1 },
  ]
  it('dois temas "Ursinha": vale o do produto do pedido (sem maiúscula/acento)', () => {
    expect(acharTema([{ produto: 'Sacola P' }], [], temas, 'ursinha')?.themeId).toBe('sac_urs')
    expect(acharTema([{ produto: 'KIT FESTA' }], [], temas, 'Ursinha')?.themeId).toBe('kit_urs')
    // produto só no título do anúncio da Shopee
    expect(acharTema([{ nome: 'Lembrancinhas Sacola P Personalizada' }], [], temas, 'Ursinha')?.themeId).toBe('sac_urs')
    expect(acharTema([{ produto: 'Tag' }], [], temas, 'Sereia')?.themeId).toBe('sereia')
  })
  it('"usar para todos os pedidos deste produto" e "produto + tema" ficam lembrados', () => {
    const ap = { [chaveProduto('Lembrancinhas SONIC Pegue e Monte')]: 'sereia' }
    expect(acharTema([{ nome: 'Lembrancinhas SONIC Pegue e Monte' }], [], temas, 'qualquer', ap)).toEqual({ themeId: 'sereia', origem: 'produto' })
    const ap2 = { [chaveProdutoTema('Sacola G', 'Fundo do Mar')]: 'sereia' }
    expect(acharTema([{ produto: 'Sacola G' }], [], temas, 'FUNDO DO MAR', ap2)).toEqual({ themeId: 'sereia', origem: 'manual' })
    expect(acharTema([{ produto: 'Sacola P' }], [], temas, 'FUNDO DO MAR', ap2)).toBeNull()
  })
  it('pedido com vários produtos: um alvo (arquivo) por produto, cada um com o seu tema', () => {
    const a = alvosDoPedido([{ produto: 'Kit Festa', nome: 'Kit' }, { produto: 'Sacola P', nome: 'Sacola' }, { produto: 'Kit Festa', nome: 'Kit 2' }], [], temas, 'Ursinha')
    expect(a.map(x => [x.produto, x.tema?.themeId, x.itens.length])).toEqual([['Kit Festa', 'kit_urs', 2], ['Sacola P', 'sac_urs', 1]])
  })
  it('pastas e nomes: Exportações/AAAA-MM-DD/<Produto>/<Nome>_<Idade>anos_<Tema>.pdf', () => {
    expect(pastaDoProduto('Exportações/2026-10-06', 'Sacola P')).toBe('Exportações/2026-10-06/Sacola P')
    expect(pastaDoProduto('Exportações/2026-10-06', 'Kit: "Festa" / 6 cxs')).toBe('Exportações/2026-10-06/Kit Festa 6 cxs')
    expect(pastaDoProduto('Exportações/2026-10-06', '')).toBe('Exportações/2026-10-06/Sem produto')
    expect(nomeTemaPronto({ nome: 'Ana Júlia', idade: '5', tema: 'Sereia', data: new Date(), extensao: 'pdf' })).toBe('AnaJúlia_5anos_Sereia.pdf')
    expect(parteArquivo('SONIC - KIT')).toBe('SONIC-KIT')
  })
  it('tema pronto com produto: produto no tema, na base e sugerido pela subpasta', () => {
    const { base, tema } = montarTemaPronto({ nome: 'Ursinha', produto: 'Sacola P', arquivo: { path: 'Temas/Sacola P/Ursinha.pdf', sha256: 'a'.repeat(64), kind: 'pdf' },
      paginas: [{ nome: 'FRENTE', wMm: 100, hMm: 120, imagem: { path: 'Temas/paginas/x/pagina-1.jpg', sha256: 'b'.repeat(64), aspect: 100 / 120, nome: 'FRENTE' } }] })
    expect(tema.produto).toBe('Sacola P')
    expect(base.name).toBe('Sacola P · Ursinha')
    expect(DocTema.parse(tema).produto).toBe('Sacola P')
    expect(produtoDoCaminho('Temas/Sacola P/Ursinha.pdf')).toBe('Sacola P')
    expect(produtoDoCaminho('Temas/Ursinha.pdf')).toBe('')
    expect(produtoDoCaminho('Temas/paginas/x/pagina-1.jpg')).toBe('')
  })
})

// ── 47 · aplique não sai impresso na caixa ───────────────────────────────────────────────────────
function baseQuadrada(): DocTrabalho {
  const d = novoDocumento('A4'); d.artboards[0] = { id: 'ab_1', widthMm: 210, heightMm: 297 }
  const q: Pt[] = [[0, 0], [100, 0], [100, 100], [0, 100]]
  d.molds = [{ id: 'a', name: 'CUBO', artboardId: 'ab_1', transform: { xMm: 50, yMm: 50, rotationDeg: 0 }, source: { path: 'Bases/moldes/a.pdf', sha256: 'a'.padEnd(64, '0'), widthMm: 100, heightMm: 100 },
    faces: facesParaReceita('a', [{ poligono: q, tipos: ['cut', 'cut', 'cut', 'cut'], furo: false }]) }] as never
  garantirPartesPadrao(d); atribuirFace(d, 'p_frente', 'f_a_1')
  return d
}
describe('47 · aplique 3D sai só nas folhas de aplique', () => {
  const tema = () => {
    const t = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    const id = colocarElemento(t, 'p_frente', { path: 'Elementos/castelo.png', sha256: 'c'.repeat(64), aspect: 1, nome: 'castelo' })
    const c = t.partContent.p_frente.find(x => x.id === id)! as { applique?: { enabled: boolean } }
    c.applique = { enabled: true }
    ;(t as { appliques?: unknown }).appliques = { enabled: true }
    return { t, id }
  }
  it('na impressão da caixa o aplique some; na tela continua (para ver a composição)', () => {
    const d = baseQuadrada(), { t, id } = tema()
    const temNo = (ls: { id: string }[]) => ls.some(n => n.id.endsWith(id))
    expect(ehAplique(t, t.partContent.p_frente[0])).toBe(true)
    expect(temNo(resolverPrancheta(d, 'ab_1', { tema: t }))).toBe(true)
    expect(temNo(resolverPrancheta(d, 'ab_1', { tema: t, modo: 'impressao', sobraMm: 3 }))).toBe(true)        // as folhas de aplique ainda acham
    expect(temNo(resolverPrancheta(d, 'ab_1', { tema: t, modo: 'impressao', sobraMm: 3, semApliques: true }))).toBe(false)
  })
  it('tema com os apliques desligados: o elemento continua na caixa', () => {
    const d = baseQuadrada(), { t, id } = tema()
    ;(t as { appliques?: { enabled: boolean } }).appliques = { enabled: false }
    expect(resolverPrancheta(d, 'ab_1', { tema: t, modo: 'impressao', sobraMm: 3, semApliques: true }).some(n => n.id.endsWith(id))).toBe(true)
  })
})
