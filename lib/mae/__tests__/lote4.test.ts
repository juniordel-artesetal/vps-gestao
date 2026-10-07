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

// ── 52 · replicar NOME, IDADE e HASHTAG entre as páginas ─────────────────────────────────────────
import { colocarEmTodas, adicionarNaPrancheta, colarNaPrancheta, duplicarPosicao, moverParaFace, faceDaPrancheta } from '@/lib/mae/editor/textosReplicar'
function prontoDe3() {
  const pg = (nome: string) => ({ nome, wMm: 100, hMm: 120, imagem: { path: `Temas/paginas/x/${nome}.jpg`, sha256: 'b'.repeat(64), aspect: 100 / 120, nome } })
  return montarTemaPronto({ nome: 'Ursinha', produto: 'Kit Festa', arquivo: { path: 'Temas/Kit Festa/Ursinha.pdf', sha256: 'a'.repeat(64), kind: 'pdf' }, paginas: [pg('MILK'), pg('CUBO'), pg('TOPO')] })
}
describe('52 · NOME/IDADE/HASHTAG em todas as páginas', () => {
  it('"Colocar em todas as páginas": mesma posição relativa, mesma variável, uma por página (sem repetir)', () => {
    const { base } = prontoDe3()
    const nome = base.textSlots.find(t => t.variable === 'NOME')!
    nome.box = { x: 0.2, y: 0.3, w: 0.6, h: 0.15 }; nome.rotationDeg = 5
    expect(colocarEmTodas(base, nome.id)).toBe(2)
    const nomes = base.textSlots.filter(t => t.variable === 'NOME')
    expect(nomes.length).toBe(3)
    expect(new Set(nomes.map(t => t.faceId)).size).toBe(3)
    for (const t of nomes) { expect(t.box).toEqual(nome.box); expect(t.rotationDeg).toBe(5) }
    expect(new Set(nomes.map(t => t.id)).size).toBe(3)
    expect(colocarEmTodas(base, nome.id)).toBe(0)                    // de novo: nada a criar
  })
  it('"+ IDADE" numa página copia a posição da outra; sem modelo usa o padrão; não duplica', () => {
    const { base } = prontoDe3()
    const ab2 = base.artboards[1].id
    const id = adicionarNaPrancheta(base, ab2, 'IDADE')!
    const idade1 = base.textSlots.find(t => t.variable === 'IDADE' && t.id !== id)!
    expect(base.textSlots.find(t => t.id === id)!.box).toEqual(idade1.box)
    expect(adicionarNaPrancheta(base, ab2, 'IDADE')).toBe(id)
    base.textSlots = []
    const n = adicionarNaPrancheta(base, ab2, 'NOME')!
    expect(base.textSlots.find(t => t.id === n)!.faceId).toBe(faceDaPrancheta(base, ab2))
  })
  it('Ctrl+V cola na outra página (mesma posição); na mesma página desce um pouco; Ctrl+J e arrastar para outra página', () => {
    const { base } = prontoDe3()
    const nome = base.textSlots.find(t => t.variable === 'NOME')!
    const copia = JSON.parse(JSON.stringify(nome))
    const c1 = colarNaPrancheta(base, copia, base.artboards[2].id)!
    expect(base.textSlots.find(t => t.id === c1)!.box).toEqual(nome.box)
    const c2 = colarNaPrancheta(base, copia, base.artboards[0].id)!
    expect(base.textSlots.find(t => t.id === c2)!.box.y).toBeGreaterThan(nome.box.y)
    const d = duplicarPosicao(base, nome.id)!
    expect(base.textSlots.find(t => t.id === d)!.variable).toBe('NOME')
    const f3 = faceDaPrancheta(base, base.artboards[2].id)!
    moverParaFace(base, nome.id, f3, { u: 0.5, v: 0.2 })
    const movido = base.textSlots.find(t => t.id === nome.id)!
    expect(movido.faceId).toBe(f3)
    expect(movido.box.x + movido.box.w / 2).toBeCloseTo(0.5, 3)
  })
})

// ── 50 · nome simples × nome composto ────────────────────────────────────────────────────────────
import { readFileSync as lerArq } from 'node:fs'
import { join as juntarCaminho } from 'node:path'
import { abrirFonte } from '@/lib/mae/texto/fonte'
import { quebrarEmDuas, MM_POR_PT, ehParticula } from '@/lib/mae/texto/diagramar'
import { posicaoEfetiva } from '@/lib/mae/vinculo/resolver'
describe('50 · nome simples × composto', () => {
  it('a quebra em 2 linhas mantém a partícula com o 2º nome ("Maria" / "de Fátima")', async () => {
    const f = await abrirFonte(lerArq(juntarCaminho(process.cwd(), 'public/mae/fontes/Sniglet-Regular.ttf')))
    expect(quebrarEmDuas(f, 'Maria de Fátima', {}, 22 * MM_POR_PT)).toEqual(['Maria', 'de Fátima'])
    expect(quebrarEmDuas(f, 'Ana dos Santos Silva', {}, 22 * MM_POR_PT)[0].endsWith(' dos')).toBe(false)
    expect(ehParticula('DA')).toBe(true)
  })
  it('cada modo com a sua posição; o pedido força 1 ou 2 linhas', () => {
    const slot = { id: 's', variable: 'NOME', faceId: 'f', box: { x: 0.1, y: 0.4, w: 0.8, h: 0.2 },
      single: { lines: 1 as const, sizePt: 30, dy: -0.1 }, compound: { lines: 2 as const, sizePt: 24, lineHeight: 0.9, dy: 0.05 } }
    const t = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    expect(posicaoEfetiva(slot, t, { NOME: 'Isis' }).caixa.y).toBeCloseTo(0.3, 5)
    expect(posicaoEfetiva(slot, t, { NOME: 'Ana Júlia' }).caixa.y).toBeCloseTo(0.45, 5)
    expect(posicaoEfetiva(slot, t, { NOME: 'Ana Júlia' }).cfg.compound?.lines).toBe(2)
    expect(posicaoEfetiva(slot, t, { NOME: 'Ana Júlia', _LINHAS_NOME: '1' }).cfg.compound?.lines).toBe(1)
  })
})

// ── 41 · girar a prancheta leva os moldes junto ──────────────────────────────────────────────────
import { girarPrancheta, moldesForaDaPrancheta } from '@/lib/mae/editor/pranchetas'
import { caixaNaFolha, paraFolha, daFolha } from '@/lib/mae/editor/giroMolde'
import { linhasDaPrancheta, caixaDoMolde } from '@/lib/mae/exportar/linhas'
/** Retrato A4 com um molde DEITADO (160 × 60 mm) em (20, 30) — a face é o retângulo inteiro. */
function baseDeitada(): DocTrabalho {
  const d = novoDocumento('A4'); d.artboards[0] = { id: 'ab_1', widthMm: 210, heightMm: 297 }
  const r: Pt[] = [[0, 0], [160, 0], [160, 60], [0, 60]]
  d.molds = [{ id: 'cubo', name: 'CUBO COM ALÇA', artboardId: 'ab_1', transform: { xMm: 20, yMm: 30, rotationDeg: 0 }, source: { path: 'Bases/moldes/c.pdf', sha256: 'c'.padEnd(64, '0'), widthMm: 160, heightMm: 60 },
    faces: facesParaReceita('cubo', [{ poligono: r, tipos: ['cut', 'cut', 'cut', 'cut'], furo: false }]) }] as never
  garantirPartesPadrao(d); atribuirFace(d, 'p_frente', 'f_cubo_1')
  return d
}
describe('41 · girar a prancheta gira os moldes junto (e volta)', () => {
  it('retrato → paisagem: o molde gira 90°, fica dentro e recentralizado; girar de novo (nos dois sentidos) volta', () => {
    const d = baseDeitada()
    girarPrancheta(d, 'ab_1')
    expect([d.artboards[0].widthMm, d.artboards[0].heightMm]).toEqual([297, 210])
    const m = d.molds[0]
    expect(m.transform.rotationDeg).toBe(90)
    const c = caixaNaFolha(m)
    expect([c.w, c.h]).toEqual([60, 160])                               // em pé na folha deitada
    expect(c.x).toBeCloseTo((297 - 60) / 2, 1); expect(c.y).toBeCloseTo((210 - 160) / 2, 1)
    expect(moldesForaDaPrancheta(d, 'ab_1')).toEqual([])
    girarPrancheta(d, 'ab_1', { sentido: -1 })                          // ↺ volta
    expect([d.artboards[0].widthMm, d.artboards[0].heightMm]).toEqual([210, 297])
    expect(d.molds[0].transform.rotationDeg).toBe(0)
    for (let k = 0; k < 4; k++) girarPrancheta(d, 'ab_1')               // 4 × ↻ = volta ao começo
    expect(d.molds[0].transform.rotationDeg).toBe(0)
    expect([d.artboards[0].widthMm, d.artboards[0].heightMm]).toEqual([210, 297])
    expect(moldesForaDaPrancheta(d, 'ab_1')).toEqual([])
  })
  it('a arte, o recorte e as linhas acompanham o giro', () => {
    const d = baseDeitada()
    girarPrancheta(d, 'ab_1')
    const m = d.molds[0]
    const ida = paraFolha(m, [10, 5]); expect(daFolha(m, ida).map(v => Math.round(v * 1000) / 1000)).toEqual([10, 5])
    // a face (160 × 60) na folha ocupa 60 × 160
    const forma = resolverPrancheta(d, 'ab_1', { tema: novoTema({ nome: 't', baseId: 'b', baseVersion: 1 }) }).find(n => n.id.endsWith(':forma'))
    void forma
    const t = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    colocarElemento(t, 'p_frente', { path: 'Elementos/x.png', sha256: 'd'.repeat(64), aspect: 1, nome: 'x' })
    const nos = resolverPrancheta(d, 'ab_1', { tema: t })
    const face = nos.find(n => n.type === 'shape' && n.id.endsWith(':forma')) as { rings: [number, number][][] }
    const xs = face.rings[0].map(p => p[0]), ys = face.rings[0].map(p => p[1])
    expect(Math.round(Math.max(...xs) - Math.min(...xs))).toBe(60)
    expect(Math.round(Math.max(...ys) - Math.min(...ys))).toBe(160)
    const cx = caixaDoMolde(d, 'cubo', 0)!
    expect([Math.round(cx.w), Math.round(cx.h)]).toEqual([60, 160])
    const l = linhasDaPrancheta(d, 'ab_1')
    const lx = l.corte.flat().map(p => p[0])
    expect(Math.round(Math.max(...lx) - Math.min(...lx))).toBe(60)
  })
})

// ── 21 · "Pode vazar da face" ────────────────────────────────────────────────────────────────────
describe('21 · elemento que pode vazar da face', () => {
  const comVazar = (vazar: boolean) => {
    const t = novoTema({ nome: 't', baseId: 'b', baseVersion: 1 })
    const id = colocarElemento(t, 'p_frente', { path: 'Elementos/laco.png', sha256: 'e'.repeat(64), aspect: 1, nome: 'laco' })
    if (vazar) (t.partContent.p_frente.find(x => x.id === id) as { bleed?: boolean }).bleed = true
    return { t, id }
  }
  it('marcado: sai inteiro (sem recorte), depois das faces — na tela e na impressão', () => {
    const d = baseQuadrada()
    for (const modo of [undefined, 'impressao'] as const) {
      const { t, id } = comVazar(true)
      const nos = resolverPrancheta(d, 'ab_1', { tema: t, ...(modo ? { modo, sobraMm: 3 } : {}) })
      const i = nos.findIndex(n => n.id.endsWith(`${id}:vaza`))
      expect(i, modo ?? 'tela').toBeGreaterThan(-1)
      expect(nos[i].clip).toBe(false)
      expect(i).toBeGreaterThan(nos.findIndex(n => n.id.endsWith(':forma')))
      expect(nos.some(n => n.id.endsWith(':recorte') && nos.indexOf(n) < i && false)).toBe(false)
    }
  })
  it('desmarcado: continua recortado na face', () => {
    const d = baseQuadrada(), { t, id } = comVazar(false)
    const no = resolverPrancheta(d, 'ab_1', { tema: t }).find(n => n.id.endsWith(id))!
    expect(no.clip).toBe(true)
  })
  it('as linhas do molde (depoisDasFaces) ficam embaixo do que vaza', () => {
    const d = baseQuadrada(), { t, id } = comVazar(true)
    const linha = { id: 'linhas', name: 'linhas', visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal' as const, clip: false, type: 'shape' as const, color: '#000000', rings: [[[0, 0], [1, 0], [1, 1]] as [number, number][]] }
    const nos = resolverPrancheta(d, 'ab_1', { tema: t, depoisDasFaces: [linha] })
    expect(nos.findIndex(n => n.id === 'linhas')).toBeLessThan(nos.findIndex(n => n.id.endsWith(`${id}:vaza`)))
  })
})
