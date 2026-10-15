// Lote 18 (itens 215–230) — rótulos Nutella duplicando nome, salvar/abrir, lote com temas de arte pronta, véspera do
// lançamento. Regras puras (sem banco, sem tela).
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { novoDocumento } from '@/lib/mae/schema/documento'
import { DocTema, DocBase, type DocTrabalho, type FolhaMontada, type NoCamada } from '@/lib/mae/schema'
import { montarBaseDeMedidas } from '@/lib/mae/medidas/pecas'
import { organizarFolha, distribuirKit, docDoKit, contagemDoKit, vagasDoKitNaFolha } from '@/lib/mae/editor/folhaMontada'
import { resumoPedidoDe, pecasNaMarca, validarFolha } from '@/lib/mae/editor/kitBase'
import { resolverPrancheta, textosForaDaPeca } from '@/lib/mae/vinculo/resolver'
import { comTextosDoTema, textoVale, marcarDono, textosRepetidos, limparTextosRepetidos, repetidoVisivelEm } from '@/lib/mae/vinculo/textosDoTema'
import { conflitosTemaBase, temConflito, moverTemaParaBase } from '@/lib/mae/vinculo/temaDaBase'
import { facesSemPapel } from '@/lib/mae/vinculo/partes'
import { temaProntoNasPecas } from '@/lib/mae/temasProntos/montar'
import { zonasDaMarca, trocarMarcaNoDoc } from '@/lib/mae/exportar/marca'
import { divisoesDe, aplicarAjustes, ajustesParaTela } from '@/lib/mae/servidor/ajustesPedido'
import { abrirFonte, type FonteHB } from '@/lib/mae/texto/fonte'

let fonte: FonteHB
beforeAll(async () => { fonte = await abrirFonte(readFileSync(join(process.cwd(), 'public/mae/fontes/Sniglet-Regular.ttf'))) })

const tema = (id: string, extra: Record<string, unknown> = {}) => DocTema.parse({ schemaVersion: 1, type: 'theme', id, version: 1, name: id, baseId: 'b', baseVersion: 1, partContent: {}, sample: { NOME: 'Antonella', IDADE: '5' }, ...extra })
const slot = (id: string, faceId: string, y: number, extra: Record<string, unknown> = {}) => ({ id, variable: 'NOME_IDADE', faceId, box: { x: 0.1, y, w: 0.8, h: 0.3 }, single: { lines: 1, sizePt: 20 }, ...extra }) as DocTrabalho['textSlots'][number]

function nutella(): { d: DocTrabalho; corpo: string; tampa: string; f1: FolhaMontada; f2: FolhaMontada; face: string } {
  const d = novoDocumento('A4')
  montarBaseDeMedidas(d, [{ nome: 'Nutella · Corpo', medida: { forma: 'retangulo', larguraMm: 200, alturaMm: 35 } }, { nome: 'Nutella · Tampa', medida: { forma: 'circulo', larguraMm: 57, alturaMm: 57 } }])
  const [corpo, tampa] = d.molds.map(m => m.id)
  // folha com ESPAÇO 0 (as peças encostadas: a sobra da impressão vira 0)
  const fol = { widthMm: 210, heightMm: 297, espacoMm: 0, margemMm: 5 }
  const f1: FolhaMontada = { id: 'f1', nome: 'rótulo frente', ...fol, pecas: organizarFolha(fol, [{ moldeId: corpo, quantidade: 7 }], d.molds).pecas.slice(0, 7) }
  const f2: FolhaMontada = { id: 'f2', nome: 'rótulo tampa', ...fol, pecas: organizarFolha(fol, [{ moldeId: tampa, quantidade: 12 }], d.molds).pecas.slice(0, 12) }
  d.folhas = [f1, f2]
  const face = d.molds[0].faces.find(x => !x.hole)!.id
  return { d, corpo, tampa, f1, f2, face }
}
const texto = (valores: Record<string, string> = {}) => ({ fontes: { obter: () => fonte, substituta: fonte }, valores })
const ids = (nos: NoCamada[]) => nos.map(n => n.id)

describe('215/222 — o texto criado no tema é SÓ daquele tema', () => {
  it('textoVale / comTextosDoTema: da base vale em todos; o do tema só nele; modo Base só vê os da base', () => {
    const { d, face } = nutella()
    d.textSlots = [slot('ts_base', face, 0.1), slot('ts_urso', face, 0.55, { tema: 'th_urso' })]
    expect(textoVale(d.textSlots[0], 'th_moana')).toBe(true)
    expect(textoVale(d.textSlots[1], 'th_moana')).toBe(false)
    expect(comTextosDoTema(d, 'th_urso').textSlots.map(s => s.id)).toEqual(['ts_base', 'ts_urso'])
    expect(comTextosDoTema(d, 'th_moana').textSlots.map(s => s.id)).toEqual(['ts_base'])
    expect(comTextosDoTema(d, null).textSlots.map(s => s.id)).toEqual(['ts_base'])
    const sem = { ...d, textSlots: [d.textSlots[0]] }
    expect(comTextosDoTema(sem, 'x')).toBe(sem)   // nenhum texto com dono: o mesmo objeto (sem custo)
  })
  it('marcarDono: só os textos NOVOS ganham o dono; no modo Base (sem tema) nada muda', () => {
    const d = { textSlots: [{ id: 'a' }, { id: 'b' }] as { id: string; tema?: string }[] }
    marcarDono(d, new Set(['a']), 'th_urso')
    expect(d.textSlots).toEqual([{ id: 'a' }, { id: 'b', tema: 'th_urso' }])
    marcarDono(d, new Set(), null)
    expect(d.textSlots[0].tema).toBeUndefined()
  })
  it('o PDF do Ursinhos sai com 2 nomes; o da Moana (mesma base) com 1', () => {
    const { d, face } = nutella()
    d.textSlots = [slot('ts_base', face, 0.1), slot('ts_urso', face, 0.55, { tema: 'th_urso' })]
    const ab = d.molds[0].artboardId
    const nomes = (t: DocTema) => resolverPrancheta(d, ab, { tema: t, texto: texto({ NOME: 'Ana', IDADE: '3' }) }).map(n => n.id.split(':')[0]).filter(id => /^ts_/.test(id)).reduce((c, id) => c.add(id), new Set<string>()).size
    expect(nomes(tema('th_urso'))).toBe(2)
    expect(nomes(tema('th_moana'))).toBe(1)
  })
  it('o schema aceita o dono (aditivo) e a base continua válida', () => {
    const { d, face } = nutella()
    d.textSlots = [slot('ts_urso', face, 0.55, { tema: 'th_urso' })]
    expect(DocBase.safeParse(d).success).toBe(true)
  })
})

describe('215 — limpar textos repetidos (o 2º "Nome + idade" que foi para os 47 temas)', () => {
  it('acha o repetido (o de baixo); o de cima fica — Lote 19 (243): só quando estão NO MESMO LUGAR (±2 mm)', () => {
    const { d, face } = nutella()
    d.textSlots = [slot('ts_cima', face, 0.075), slot('ts_longe', face, 0.547)]
    expect(textosRepetidos(d)).toHaveLength(0)   // o mesmo nome em outro lugar é intencional
    d.textSlots = [slot('ts_cima', face, 0.075), slot('ts_baixo', face, 0.085)]
    const r = textosRepetidos(d)
    expect(r).toHaveLength(1)
    expect(r[0].manter.id).toBe('ts_cima'); expect(r[0].repetidos.map(s => s.id)).toEqual(['ts_baixo'])
  })
  it('sai da base; o Ursinhos (marcado) fica com ele como texto SÓ DELE, com o ajuste; os outros perdem; ajustes órfãos saem', () => {
    const { d, face } = nutella()
    d.textSlots = [slot('ts_cima', face, 0.075), slot('ts_baixo', face, 0.547)]
    const urso = tema('th_urso', { textSlotAdjust: { ts_baixo: { dx: 0.1 }, ts_velho: { hidden: true } } })
    const moana = tema('th_moana', { textSlotAdjust: { ts_baixo: { hidden: true } } })
    const capivara = tema('th_capi')
    expect([urso, moana, capivara].filter(t => repetidoVisivelEm(t, 'ts_baixo')).map(t => t.id)).toEqual(['th_urso', 'th_capi'])
    const mudados = limparTextosRepetidos(d, [urso, moana, capivara], ['ts_baixo'], { ts_baixo: ['th_urso'] })
    expect(d.textSlots.filter(s => !s.tema).map(s => s.id)).toEqual(['ts_cima'])
    const copia = d.textSlots.find(s => s.tema === 'th_urso')!
    expect(copia.box.y).toBe(0.547)
    const u = mudados.find(t => t.id === 'th_urso')!
    expect(u.textSlotAdjust![copia.id]).toEqual({ dx: 0.1 })
    expect(u.textSlotAdjust!.ts_velho).toBeUndefined()
    expect(mudados.find(t => t.id === 'th_moana')!.textSlotAdjust!.ts_baixo).toBeUndefined()
    expect(comTextosDoTema(d as DocTrabalho, 'th_capi').textSlots.map(s => s.id)).toEqual(['ts_cima'])   // a Capivara (Luisa) com UM nome
  })
})

describe('215 — na impressão o texto é SEMPRE recortado na peça (mesmo sem sangria)', () => {
  it('folha com espaço 0 → sobra 0: o texto ganha o recorte no contorno da peça (antes saía sem recorte, no vizinho)', () => {
    const { d, face } = nutella()
    d.textSlots = [slot('ts_n', face, 0.6)]
    const ab = d.molds[0].artboardId
    const imp = resolverPrancheta(d, ab, { tema: tema('th'), modo: 'impressao', sobraMm: 0, texto: texto({ NOME: 'Antonella', IDADE: '5' }) })
    const i = ids(imp).indexOf('ts_n:recorte')
    expect(i).toBeGreaterThanOrEqual(0)
    expect((imp[i] as { clipOnly?: boolean }).clipOnly).toBe(true)
    expect((imp[i + 1] as { clip?: boolean }).clip).toBe(true)
    // na tela não recorta (dá para ver o que passou e corrigir)
    expect(ids(resolverPrancheta(d, ab, { tema: tema('th'), texto: texto({ NOME: 'Antonella' }) }))).not.toContain('ts_n:recorte')
  })
  it('textosForaDaPeca: a idade que cai para fora do rótulo vira aviso; a de dentro, não', () => {
    const { d, face } = nutella()
    d.textSlots = [slot('ts_dentro', face, 0.3), slot('ts_fora', face, 0.85)]
    const r = textosForaDaPeca(d, tema('th'))
    expect(r.map(x => x.slotId)).toEqual(['ts_fora'])
    expect(r[0].molde).toBe('Nutella · Corpo')
    expect(textosForaDaPeca(d, tema('th', { textSlotAdjust: { ts_fora: { hidden: true } } }))).toEqual([])   // oculto não conta
  })
})

describe('217 — lote com temas de ARTE PRONTA: cada pedido com a arte do seu tema', () => {
  it('Bento (Pooh) + Ana (Pool Party): cada rótulo leva a arte do tema do SEU pedido', () => {
    const { d, corpo, tampa, f1, f2 } = nutella()
    const img = (n: string) => ({ path: `Temas/paginas/${n}.jpg`, sha256: 'abcd', aspect: 200 / 35 })
    const pooh = { ...temaProntoNasPecas({ nome: 'Pooh', base: d, pecas: [{ moldeId: corpo, imagem: img('pooh') }, { moldeId: tampa, imagem: { ...img('pooh-tampa'), aspect: 1 } }] }), id: 'th_pooh' } as DocTema
    const pool = { ...temaProntoNasPecas({ nome: 'Pool Party', base: d, pecas: [{ moldeId: corpo, imagem: img('pool') }] }), id: 'th_pool' } as DocTema
    const comp = [{ moldeId: corpo, qtd: 1 }, { moldeId: tampa, qtd: 1 }]
    const dist = distribuirKit([{ folha: f1, impressoes: 1 }, { folha: f2, impressoes: 1 }], [{ kits: 3, pecas: 0 }, { kits: 3, pecas: 0 }], 'composicao', true, comp)
    const kd = docDoKit(d, pooh, dist, [{ rotulo: '#1 · Bento', valores: { NOME: 'Bento' } }, { rotulo: '#2 · Ana', valores: { NOME: 'Ana' } }], [pooh, pool])
    const artes = kd.artboardIds.flatMap(ab => resolverPrancheta(kd.doc, ab, { tema: kd.tema, modo: 'impressao', sobraMm: 0 }).filter(n => n.id.endsWith(':peca-pronta')).map(n => (n as { src: { path: string } }).src.path))
    expect(artes.filter(p => p.includes('pooh.jpg'))).toHaveLength(3)       // 3 corpos do Bento
    expect(artes.filter(p => p.includes('pool.jpg'))).toHaveLength(3)       // 3 corpos da Ana (antes: 6 do Pooh)
    expect(artes.filter(p => p.includes('pooh-tampa'))).toHaveLength(3)     // só as tampas do Bento; a Ana não tem arte de tampa
    expect(DocTema.safeParse(kd.tema).success).toBe(true)                   // null (sem arte) é aceito
  })
  it('230 — peça com arte pronta não conta como "face sem papel"', () => {
    const { d, corpo } = nutella()
    const t = temaProntoNasPecas({ nome: 'x', base: d, pecas: [{ moldeId: corpo, imagem: { path: 'Temas/paginas/x.jpg', sha256: 'abcd', aspect: 4 } }] })
    const sem = facesSemPapel(d, t as never)
    expect(sem.some(f => d.molds[0].faces.some(x => x.id === f))).toBe(false)
    expect(sem.some(f => d.molds[1].faces.some(x => x.id === f))).toBe(true)   // a tampa (sem arte) continua avisando
  })
})

describe('221 — elemento (laço) por cima da arte pronta', () => {
  it('o papel da peça sai; o elemento volta POR CIMA da arte, recortado na peça', () => {
    const { d, corpo, f1 } = nutella()
    const fundo = d.parts.find(p => p.name === 'Corpo · FUNDO')!.id
    const t = temaProntoNasPecas({ nome: 'x', base: d, pecas: [{ moldeId: corpo, imagem: { path: 'Temas/paginas/x.jpg', sha256: 'abcd', aspect: 200 / 35 } }] })
    t.partContent = { [fundo]: [
      { id: 'papel', type: 'image', anchor: 'paper', path: 'Papéis/p.png', sha256: 'abcd', aspect: 1 },
      { id: 'laco', type: 'image', anchor: 'face', path: 'Elementos/laco.png', sha256: 'abcd', aspect: 1, transform: { x: 0.5, y: 0.5, scale: 0.3, rotationDeg: 0 } },
    ] } as never
    const kd = docDoKit(d, t, distribuirKit([{ folha: f1, impressoes: 1 }], [{ kits: 1, pecas: 0 }], 'composicao', false, [{ moldeId: corpo, qtd: 1 }]), [{ rotulo: '', valores: {} }])
    const nos = resolverPrancheta(kd.doc, kd.artboardIds[0], { tema: kd.tema, modo: 'impressao', sobraMm: 0 })
    const s = JSON.stringify(nos)
    expect(s).not.toContain('Papéis/p.png')
    const iArte = nos.findIndex(n => n.id.endsWith(':peca-pronta')), iLaco = nos.findIndex(n => JSON.stringify(n).includes('Elementos/laco.png'))
    expect(iArte).toBeGreaterThanOrEqual(0)
    expect(iLaco).toBeGreaterThan(iArte)
    expect((nos[iLaco] as { clip?: boolean }).clip).toBe(true)
  })
})

describe('218/226 — o tema e a base dele', () => {
  it('conflitos: arte numa parte que saiu da base, ajuste num texto que saiu', () => {
    const { d, face } = nutella()
    d.textSlots = [slot('ts_n', face, 0.1)]
    const t = tema('th', { partContent: { p_saiu: [{ id: 'l', type: 'image', anchor: 'paper', path: 'Papéis/x.png', sha256: 'abcd', aspect: 1 }] }, textSlotAdjust: { ts_saiu: { dx: 0.1 }, ts_n: { dx: 0.2 } } })
    const c = conflitosTemaBase(d, t)
    expect(c.partes).toEqual(['p_saiu']); expect(c.textos).toEqual(['ts_saiu']); expect(temConflito(c)).toBe(true)
  })
  it('mover tema para outra base: peças e partes pelo nome; textos pela variável; o que não encaixa volta como conflito', () => {
    const a = nutella(), b = nutella()
    a.d.textSlots = [slot('ts_a', a.face, 0.1), slot('ts_so', a.face, 0.5, { tema: 'th' })]
    b.d.textSlots = [slot('ts_b', b.face, 0.2)]
    const fa = a.d.parts.find(p => p.name === 'Corpo · FUNDO')!.id, fb = b.d.parts.find(p => p.name === 'Corpo · FUNDO')!.id
    const t = tema('th', { partContent: { [fa]: [{ id: 'l', type: 'image', anchor: 'paper', path: 'Papéis/x.png', sha256: 'abcd', aspect: 1 }], p_fantasma: [{ id: 'l2', type: 'image', anchor: 'paper', path: 'Papéis/y.png', sha256: 'abcd', aspect: 1 }] }, textSlotAdjust: { ts_a: { dx: 0.3 } }, pecasProntas: { [a.corpo]: { path: 'Temas/p.jpg', sha256: 'abcd', aspect: 2 } } })
    const r = moverTemaParaBase(t, a.d, { ...b.d, id: 'base_b', version: 4 })
    expect(r.tema.baseId).toBe('base_b'); expect(r.tema.baseVersion).toBe(4)
    expect((r.tema.partContent[fb][0] as { path: string }).path).toBe('Papéis/x.png')
    expect(r.tema.textSlotAdjust!.ts_b).toEqual({ dx: 0.3 })
    expect(Object.keys(r.tema.pecasProntas!)).toEqual([b.corpo])
    expect(r.textosDoTema.map(s => s.faceId)).toEqual([b.face])   // o texto só deste tema vai junto
    expect(r.conflitos.join(' ')).toMatch(/p_fantasma/)
  })
})

describe('219/220 — peças por unidade do pedido (uma regra só)', () => {
  it('a contagem é sempre "peças por unidade" (os radios saíram); base antiga sem composição = 1 de cada', () => {
    expect(contagemDoKit({ contagem: 'kit' }, [])).toBe('composicao')
    expect(contagemDoKit({ contagem: 'pecas' }, [])).toBe('composicao')
    expect(contagemDoKit(null, [])).toBe('composicao')
    const { f1 } = nutella()
    expect(vagasDoKitNaFolha(f1, undefined, 10)).toBe(10)   // 10 unidades = 10 corpos (antes: folha cheia por kit)
  })
  it('"Pedido de 96 = 4 folhas (24 + 24 + 24 + 24)" e "Pedido de 15 = 5 folhas (corpo 7 + 7 + 1 · tampa 12 + 3)"', () => {
    const d = novoDocumento('A4')
    montarBaseDeMedidas(d, [{ nome: 'Tag', medida: { forma: 'retangulo', larguraMm: 40, alturaMm: 40 } }])
    const fol = { widthMm: 210, heightMm: 297, espacoMm: 2, margemMm: 5 }
    const f: FolhaMontada = { id: 'f', nome: 'Folha', ...fol, pecas: organizarFolha(fol, [{ moldeId: d.molds[0].id, quantidade: 24 }], d.molds).pecas.slice(0, 24) }
    expect(f.pecas.length).toBe(24)
    expect(resumoPedidoDe([f], undefined, d.molds, 96)).toBe('Pedido de 96 = 4 folhas (24 + 24 + 24 + 24)')
    const n = nutella()
    expect(resumoPedidoDe([n.f1, n.f2], undefined, n.d.molds, 15)).toBe('Pedido de 15 = 5 folhas (corpo 7 + 7 + 1 · tampa 12 + 3)')
  })
})

describe('224 — dividir o pedido', () => {
  it('_mae.divisoes: 2 a 6 partes, saneadas (sufixo A, B…); null desfaz', () => {
    expect(divisoesDe({ divisoes: [{ NOME: 'Ana', qtd: 6 }] })).toBeNull()
    const d = divisoesDe({ divisoes: [{ NOME: ' Ana ', IDADE: '3', qtd: 6, temaId: 'th_x' }, { NOME: 'Bia', qtd: '6', temaId: 'x y' }] })!
    expect(d).toEqual([{ sufixo: 'A', NOME: 'Ana', IDADE: '3', temaId: 'th_x', qtd: 6 }, { sufixo: 'B', NOME: 'Bia', qtd: 6 }])
    const mae = aplicarAjustes({}, { divisoes: [{ NOME: 'Ana' }, { NOME: 'Bia' }] })
    expect(ajustesParaTela(mae).divisoes).toHaveLength(2)
    expect(ajustesParaTela(aplicarAjustes(mae, { divisoes: null })).divisoes).toBeNull()
  })
})

describe('225/229 — marcas de registro', () => {
  it('zonas v3: um grupo grande (marca "L" + texto) vira as faixas de tinta, não a caixa inteira', () => {
    const px = 4, w = 100 * px, h = 100 * px
    const rgba = new Uint8ClampedArray(w * h * 4)
    const pinta = (x0: number, y0: number, x1: number, y1: number) => { for (let y = y0 * px; y < y1 * px; y++) for (let x = x0 * px; x < x1 * px; x++) { const i = (y * w + x) * 4; rgba[i + 3] = 255 } }
    pinta(0, 0, 60, 2); pinta(0, 0, 2, 60)   // o "L" do canto: 60 mm de braço, 2 mm de grossura
    const zonas = zonasDaMarca(rgba, w, h, px)
    const area = zonas.reduce((s, z) => s + z.w * z.h, 0)
    expect(area).toBeLessThan(60 * 60 * 0.3)   // nada perto do quadrado de 60 × 60
    // uma peça de 20 × 20 no "miolo" do L não toca a marca; a que encosta no braço, sim (e diz qual)
    const { d } = nutella()
    const f = { pecas: [{ moldeId: d.molds[1].id, xMm: 20, yMm: 20, rot: 0 as const }, { moldeId: d.molds[1].id, xMm: 0, yMm: 0, rot: 0 as const }] }
    expect(pecasNaMarca(f, d.molds, zonas)).toEqual([1])
    const av = validarFolha({ id: 'f', nome: 'F', widthMm: 210, heightMm: 297, espacoMm: 0, margemMm: 0, pecas: f.pecas, pedidas: [{ moldeId: d.molds[1].id, qtd: 2 }] } as never, d.molds, zonas)
    expect(av.join(' ')).toMatch(/A peça Nutella · Tampa nº 2 invade a área da marca/)
  })
  it('trocar a marca nas bases: todas as pranchetas/folhas com a antiga passam para a nova', () => {
    const doc = { artboards: [{ registrationPresetId: 'mr_velha' }, { registrationPresetId: 'mr_outra' }], folhas: [{ registrationPresetId: 'mr_velha' }] }
    expect(trocarMarcaNoDoc(doc, 'mr_velha')).toBe(2)   // só conta
    expect(trocarMarcaNoDoc(doc, 'mr_velha', { id: 'mr_nova', sha256: 'ff' })).toBe(2)
    expect(doc.artboards[0]).toEqual({ registrationPresetId: 'mr_nova', registrationPresetSha: 'ff' })
    expect(trocarMarcaNoDoc(doc, 'mr_velha')).toBe(0)
  })
})
