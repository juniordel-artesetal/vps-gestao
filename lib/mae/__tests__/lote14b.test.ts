// Lote 14 — P1/P2: tela Gerar (199/201), "a mesma caixa junta" (200), erros com a causa (193), folhas do kit (189),
// conjunto de aplique (195), estilos que escalam (197), tema pronto numa base existente (194).
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { novoDocumento } from '@/lib/mae/schema/documento'
import { DocTema, type FolhaMontada } from '@/lib/mae/schema'
import { planejarGeracao, chaveDaCaixa, nomeDeCaixa, escolhasValidas, ESCOLHAS_PADRAO } from '@/lib/mae/exportar/planejar'
import { ordenarLote, nomeDoLote } from '@/lib/mae/pedidos/ordemLote'
import { causaSemArte, pareceArte } from '@/lib/mae/editor/diagnostico'
import { montarFolhaDoKit, validarFolha, resumoDoKit, exemploDoPedido, sincronizarKit, grupoDoKit } from '@/lib/mae/editor/kitBase'
import { montarBaseDeMedidas, novaPeca } from '@/lib/mae/medidas/pecas'
import { resolverPrancheta } from '@/lib/mae/vinculo/resolver'
import { casarPaginas, temaProntoNaBase } from '@/lib/mae/temasProntos/montar'
import { abrirFonte, type FonteHB } from '@/lib/mae/texto/fonte'
import { noDoTexto } from '@/lib/mae/texto/noTexto'
import { ESTILO_PADRAO } from '@/lib/mae/texto/noTexto'
import { montarFolhas } from '@/lib/mae/apliques/folhas'

const tema0 = (extra: Partial<DocTema> = {}) => DocTema.parse({ schemaVersion: 1, type: 'theme', id: 'th', version: 1, baseId: 'b', baseVersion: 1, partContent: {}, ...extra })

describe('201/199 — a tela Gerar: o resumo antes de clicar', () => {
  const itens = [{ pedido: 'p1', produto: 'Tags' }, { pedido: 'p2', produto: 'Pegue e Monte' }, { pedido: 'p3', produto: 'Pegue e Monte' }]
  it('um PDF por pedido: 3 arquivos', () => expect(planejarGeracao(itens, { modo: 'pedido', porProduto: true, maxPedidos: 10 }).arquivos).toBe(3))
  it('lote por tipo de produto: 2 arquivos (Tags · Pegue e Monte); lote sem separar: 1', () => {
    const p = planejarGeracao(itens, { modo: 'lote', porProduto: true, maxPedidos: 10 })
    expect(p.arquivos).toBe(2); expect(p.linhas.find(l => l.produto === 'Pegue e Monte')?.pedidos).toBe(2)
    expect(planejarGeracao(itens, { modo: 'lote', porProduto: false, maxPedidos: 10 }).arquivos).toBe(1)
    expect(planejarGeracao(itens, { modo: 'lote', porProduto: false, maxPedidos: 2 }).arquivos).toBe(2)
  })
  it('as escolhas guardadas de uma versão antiga não quebram a tela', () => {
    expect(escolhasValidas({ modo: 'xpto', maxPedidos: 999, linhas: 'sim' })).toMatchObject({ modo: 'pedido', maxPedidos: 50, linhas: ESCOLHAS_PADRAO.linhas })
  })
  it('o nome do lote diz o produto quando separa por produto (os DOIS arquivos)', () => {
    expect(nomeDoLote({ data: new Date(2026, 9, 14, 11), papel: 'Tags', pedidos: 1, parte: 1, partes: 1, paginas: 4 })).toBe('LOTE_14-10_11h_Tags_1pedido_4pag')
  })
})

describe('200 — "a mesma caixa junta" pela marca de registro', () => {
  it('PIRAMIDE = PIRÂMIDE; "_molde", "_MR", "marca registro" não contam', () => {
    expect(nomeDeCaixa('PIRAMIDE')).toBe(nomeDeCaixa('PIRÂMIDE'))
    expect(nomeDeCaixa('cubo_marca registro')).toBe(nomeDeCaixa('CUBO'))
    expect(nomeDeCaixa('MILK_molde')).toBe(nomeDeCaixa('milk'))
  })
  it('o lote Transformers × Moana: 6 caixas, cada uma com os dois temas juntos (pela marca, não pelo nome)', () => {
    const caixas: [string, string, string][] = [['MILK', 'MILK', 'mr-milk'], ['CUBO COM ALÇA', 'CUBO', 'mr-cubo'], ['MALETA COM ALÇA', 'MAL ALÇA', 'mr-mal'], ['MALETA CORAÇÃO', 'MAL CORAÇÃO', 'mr-cor'], ['TRIANGULOVE', 'TRIANGULOVE', 'mr-tri'], ['PIRÂMIDE', 'PIRAMIDE', 'mr-pir']]
    const blocos = [
      ...caixas.map(([nome, , mr], i) => ({ pedido: 'trans', tema: 'Transformers', modelo: chaveDaCaixa({ registrationPresetId: mr, name: nome }), indice: i })),
      ...caixas.map(([, nome, mr], i) => ({ pedido: 'moana', tema: 'Moana', modelo: chaveDaCaixa({ registrationPresetId: mr, name: nome }), indice: i })),
    ]
    const r = ordenarLote(blocos, 'modelo', true)
    const grupos = r.map(b => b.modelo).filter((m, i, l) => l.indexOf(m) === i)
    expect(grupos.length).toBe(6)
    for (let g = 0; g < 6; g++) expect(new Set(r.slice(g * 2, g * 2 + 2).map(b => b.tema))).toEqual(new Set(['Transformers', 'Moana']))
  })
  it('sem marca: o nome comparável, ou o "Mesma caixa que…"', () => {
    expect(chaveDaCaixa({ name: 'PIRAMIDE' })).toBe(chaveDaCaixa({ name: 'PIRÂMIDE' }))
    expect(chaveDaCaixa({ name: 'CUBO', mesmaCaixa: 'CUBO COM ALÇA' })).toBe(chaveDaCaixa({ name: 'CUBO COM ALÇA' }))
  })
})

describe('193 — a mensagem diz a causa real', () => {
  it('molde que perdeu o arquivo, grupo vazio, molde sem faces', async () => {
    const m = { id: 'm1', name: 'teste tag', faces: [], source: { path: 'Bases/teste tag.png', kind: 'png' } } as never
    expect(await causaSemArte({ molds: [m] }, async () => false)).toMatch(/O molde "teste tag" perdeu o arquivo — PNG não encontrado na Biblioteca/)
    expect(await causaSemArte({ molds: [] }, async () => true)).toMatch(/não tem peças/)
    expect(await causaSemArte({ molds: [m] }, async () => true)).toMatch(/não tem faces/)
  })
  it('PNG colorido parece arte; o contorno preto no branco não', () => {
    const img = (fn: (i: number) => [number, number, number]) => { const a = new Uint8ClampedArray(100 * 4); for (let i = 0; i < 100; i++) { const [r, g, b] = fn(i); a.set([r, g, b, 255], i * 4) } return a }
    expect(pareceArte(img(i => (i % 2 ? [220, 60, 90] : [40, 120, 220])))).toBe(true)
    expect(pareceArte(img(i => (i % 10 === 0 ? [0, 0, 0] : [255, 255, 255])))).toBe(false)
  })
})

describe('189 — folhas do kit', () => {
  it('orientação automática: a que coloca mais; "cabem até"; validações; o resumo e o exemplo do pedido', () => {
    const d = novoDocumento('A4')
    montarBaseDeMedidas(d, [{ nome: 'Tag', medida: { forma: 'circulo', larguraMm: 40, alturaMm: 40, furo: { x: 0.5, y: 0.14, diametroMm: 3.5 } } }])
    const f: FolhaMontada = { id: 'f1', nome: 'Folha 1', widthMm: 210, heightMm: 297, espacoMm: 2, margemMm: 5, pecas: [], orientacao: 'auto', pedidas: [{ moldeId: d.molds[0].id, qtd: 24 }] }
    const r = montarFolhaDoKit(f, d.molds, () => [])
    expect(r.pecas.length).toBe(24); expect(r.ficaram).toBe(0); expect(r.cabemAte).toBeGreaterThanOrEqual(24)
    const fixa = montarFolhaDoKit({ ...f, orientacao: 'retrato', pedidas: [{ moldeId: d.molds[0].id, qtd: 40 }] }, d.molds, () => [])
    expect(fixa.widthMm).toBe(210); expect(fixa.ficaram).toBeGreaterThan(0)
    expect(validarFolha({ ...f, pecas: [{ moldeId: d.molds[0].id, xMm: 190, yMm: 10, rot: 0 }] }, d.molds, [])).toEqual(expect.arrayContaining([expect.stringMatching(/fora da folha/)]))
    expect(resumoDoKit([{ nome: 'Folha 1', impressoes: 2 }, { nome: 'Folha 2', impressoes: 3 }])).toBe('Este kit = 5 folhas impressas (Folha 1 × 2 · Folha 2 × 3)')
    expect(exemploDoPedido([{ pecas: r.pecas, impressoes: 1 }], 'pecas', 'tags')).toBe('96 tags = 4 folhas')
  })
  it('peça grande demais e furo fora da peça viram aviso', () => {
    const d = novoDocumento('A4')
    d.molds.push(novaPeca('Painel', { forma: 'retangulo', larguraMm: 400, alturaMm: 50 }, d.artboards[0].id), novaPeca('Tag', { forma: 'circulo', larguraMm: 20, alturaMm: 20, furo: { x: 0.5, y: 0.02, diametroMm: 5 } }, d.artboards[0].id))
    const av = validarFolha({ id: 'f', nome: 'F', widthMm: 210, heightMm: 297, espacoMm: 2, margemMm: 5, pecas: [], pedidas: [{ moldeId: d.molds[0].id, qtd: 1 }, { moldeId: d.molds[1].id, qtd: 1 }] }, d.molds, [])
    expect(av.some(a => /maior que a folha/.test(a))).toBe(true); expect(av.some(a => /furo/.test(a))).toBe(true)
  })
  it('o kit da base de peças sob medida: um grupo só (o produto do SOA) com todas as folhas, sem "1 de cada" escondido', () => {
    const d = novoDocumento('A4')
    montarBaseDeMedidas(d, [{ nome: 'Tag', medida: { forma: 'circulo', larguraMm: 40, alturaMm: 40 } }])
    d.folhas = [{ id: 'f1', nome: 'F1', widthMm: 210, heightMm: 297, espacoMm: 2, margemMm: 5, pecas: [] }, { id: 'f2', nome: 'F2', widthMm: 210, heightMm: 297, espacoMm: 2, margemMm: 5, pecas: [] }]
    sincronizarKit(d)
    expect(d.grupos?.length).toBe(1); expect(grupoDoKit(d)?.folhas).toEqual(['f1', 'f2']); expect(grupoDoKit(d)?.composicao).toBeUndefined()
  })
})

describe('195 — conjunto de aplique', () => {
  const doc = () => { const d = novoDocumento('A4'); montarBaseDeMedidas(d, [{ nome: 'Peça', medida: { forma: 'retangulo', larguraMm: 100, alturaMm: 100 } }]); return d }
  const conjunto = (extra: Record<string, unknown> = {}) => ({ id: 'cj', type: 'conjunto', anchor: 'face', aspect: 1, transform: { x: 0.5, y: 0.5, scale: 0.5, rotationDeg: 0 }, ...extra,
    pecas: [{ id: 'p0', nome: 'Círculo', tipo: 'impressa', cor: '#ffffff', forma: { kind: 'ellipse', params: { radius: 0, sides: 6, inner: 0.5 } }, aspect: 1, x: 0.5, y: 0.5, escala: 0.8, effects: [{ type: 'stroke', sizeMm: 1, color: '#000000', position: 'outside', opacity: 1, blendMode: 'normal', enabled: true }] },
      { id: 'p1', nome: 'Personagem', tipo: 'impressa', cor: '#ff0000', forma: { kind: 'rect', params: { radius: 0, sides: 4, inner: 0.5 } }, aspect: 1, x: 0.5, y: 0.5, escala: 1, recortarAbaixo: true }] })
  it('estilos da peça e do conjunto entram na arte; "recortar pela peça de baixo" = máscara de corte', () => {
    const d = doc()
    const t = tema0({ partContent: { [d.parts[0].id]: [conjunto({ effects: [{ type: 'dropShadow', sizeMm: 1, distanceMm: 1, angleDeg: 120, color: '#000000', opacity: 0.5, blendMode: 'multiply', enabled: true }] })] } as never })
    const nos = resolverPrancheta(d, d.artboards[0].id, { tema: t })
    const todos = (ns: never[]): never[] => ns.flatMap((n: { type?: string; children?: never[] }) => (n.type === 'group' ? [n as never, ...todos(n.children ?? [])] : [n as never]))
    const lista = todos(nos as never) as { id: string; effects?: { type: string }[]; clip?: boolean }[]
    const g = lista.find(n => n.id.endsWith(':cj') || n.id === 'cj' || /cj$/.test(n.id))
    expect(lista.some(n => n.effects?.some(e => e.type === 'dropShadow'))).toBe(true)
    expect(lista.some(n => /p0/.test(n.id) && n.effects?.some(e => e.type === 'stroke'))).toBe(true)
    expect(lista.find(n => /p1/.test(n.id))?.clip).toBe(true)
    void g
  })
  it('folhas de aplique: sem títulos por padrão; peça arrastada fica onde a usuária pôs', () => {
    const peca = (id: string) => ({ id, moldeNome: id, wMm: 30, hMm: 30, borda: [], silhueta: [[[0, 0], [30, 0], [30, 30], [0, 30]]], cfg: { borderMm: 0, borderColor: '#fff', silhouetteMm: 3 }, src: { path: 'x.png', sha256: 'x' } }) as never
    const r = montarFolhas([peca('a'), peca('b')], { wMm: 210, hMm: 297 }, { fixas: { a: { x: 100, y: 150 } } })
    const a = r.colocadas.find(c => c.id === 'a')!
    expect([a.x, a.y]).toEqual([100, 150])
    expect(r.impressos.some(n => n.id.endsWith(':rotulo'))).toBe(false)
  })
})

describe('197 — os estilos acompanham o tamanho', () => {
  let f: FonteHB
  beforeAll(async () => { f = await abrirFonte(readFileSync(join(process.cwd(), 'public/mae/fontes/Sniglet-Regular.ttf'))) })
  it('camada redimensionada depois do estilo: contorno × (escala nova ÷ escala do estilo); sem referência = igual (temas antigos)', () => {
    const d = novoDocumento('A4'); montarBaseDeMedidas(d, [{ nome: 'Peça', medida: { forma: 'retangulo', larguraMm: 100, alturaMm: 100 } }])
    const forma = (extra: Record<string, unknown>) => tema0({ partContent: { [d.parts[0].id]: [{ id: 'fm', type: 'shape', kind: 'rect', params: { radius: 0, sides: 4, inner: 0.5 }, fill: '#ff0000', stroke: { color: '#000000', widthMm: 1 }, aspect: 1, anchor: 'face', transform: { x: 0.5, y: 0.5, scale: 0.25, rotationDeg: 0 }, effects: [{ type: 'stroke', sizeMm: 2, color: '#000000', position: 'outside', opacity: 1, blendMode: 'normal', enabled: true }], ...extra }] } as never })
    const ef = (t: DocTema) => { const n = resolverPrancheta(d, d.artboards[0].id, { tema: t }).find(x => x.id.endsWith(':fm') || /fm/.test(x.id)) as { effects?: { sizeMm: number }[]; stroke?: { widthMm: number } } | undefined; return n }
    expect(ef(forma({}))?.effects?.[0].sizeMm).toBe(2)
    const n = ef(forma({ efeitosRef: 0.5 }))
    expect(n?.effects?.[0].sizeMm).toBe(1); expect(n?.stroke?.widthMm).toBe(0.5)
    expect(ef(forma({ efeitosRef: 0.5, escalarEstilos: false }))?.effects?.[0].sizeMm).toBe(2)
  })
  it('nome longo que encolhe para caber: o contorno encolhe junto ("Ana" e "Maria Eduarda Beatriz" com o mesmo visual)', () => {
    const fontes = { obter: () => f, substituta: f } as never
    const estilo = { ...ESTILO_PADRAO, font: { postscriptName: 'Sniglet-Regular', family: 'Sniglet' }, effects: [{ type: 'stroke', sizeMm: 2, color: '#000000', position: 'outside', opacity: 1, blendMode: 'normal', enabled: true }] } as never
    const base = { slotId: 's', variavel: 'NOME', estilo, fontes, quadro: [100, 0, 0, 30, 0, 0] as never, w: 100, h: 30, caixa: { x: 0, y: 0, w: 1, h: 1 }, cfg: { single: { lines: 1 as const, sizePt: 60 }, autoFit: { minScale: 0.2 } } as never }
    const curto = noDoTexto({ ...base, valor: 'Ana' })!, longo = noDoTexto({ ...base, valor: 'Maria Eduarda Beatriz' })!
    const sz = (r: typeof curto) => (r.no.effects as { sizeMm: number }[])[0].sizeMm
    expect(longo.info.escala).toBeLessThan(1)
    expect(sz(longo)).toBeCloseTo(2 * longo.info.escala, 1)
    expect(sz(curto)).toBeCloseTo(2 * curto.info.escala, 1)
    expect(sz(noDoTexto({ ...base, valor: 'Maria Eduarda Beatriz', estilo: { ...(estilo as object), escalarEstilos: false } as never })!)).toBe(2)
  })
})

describe('194 — tema pronto numa base que já existe', () => {
  const base = () => {
    const d = novoDocumento('A4')
    d.artboards = [{ id: 'ab1', widthMm: 297, heightMm: 210, name: 'PIRÂMIDE' }, { id: 'ab2', widthMm: 297, heightMm: 210, name: 'CUBO COM ALÇA' }, { id: 'ab3', widthMm: 297, heightMm: 210, name: 'MILK' }]
    for (const ab of d.artboards) { const m = novaPeca(ab.name!, { forma: 'retangulo', larguraMm: 100, alturaMm: 100 }, ab.id); d.molds.push(m) }
    d.artboards[1] = { ...d.artboards[1], mesmaCaixa: 'CUBO' } as never
    return d
  }
  it('cada página na caixa de mesmo nome (PIRAMIDE = PIRÂMIDE, "Mesma caixa que…"); avisos sem encaixe errado', () => {
    const c = casarPaginas([{ nome: 'PIRAMIDE', wMm: 297, hMm: 210 }, { nome: 'CUBO', wMm: 297, hMm: 210 }, { nome: 'TOPO', wMm: 297, hMm: 210 }, { nome: 'MILK', wMm: 200, hMm: 200 }], base())
    expect(c.pares.map(p => p.artboardId)).toEqual(['ab1', 'ab2', 'ab3'])
    expect(c.semPrancheta).toEqual([2])
    expect(c.tamanhoDiferente.map(t => t.nome)).toEqual(['MILK'])
  })
  it('a página entra inteira na prancheta (sem arte de face); "Este PDF já tem marca de registro" fica no tema', () => {
    const d = base()
    const t = temaProntoNaBase({ nome: 'Moana', produto: 'Kit Festa', base: d, semMarca: true, paginas: [{ artboardId: 'ab1', imagem: { path: 'Temas/paginas/moana/pagina-1.jpg', sha256: 'a'.repeat(64), aspect: 297 / 210 } }] })
    expect((t as { semMarca?: boolean }).semMarca).toBe(true)
    const nos = resolverPrancheta(d, 'ab1', { tema: t })
    expect(nos[0]).toMatchObject({ type: 'image', matrix: [297, 0, 0, 210, 0, 0] })
    expect(nos.some(n => n.id.endsWith(':forma'))).toBe(false)
  })
})
