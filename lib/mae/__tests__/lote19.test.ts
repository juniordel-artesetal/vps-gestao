// Lote 19 (itens 231–245) — lote mudando a arte da Nutella, dois nomes no mesmo pedido, tipo de produto no lote,
// corte com faca. Regras puras (sem banco, sem tela).
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { novoDocumento } from '@/lib/mae/schema/documento'
import { DocTema, type DocTrabalho, type FolhaMontada, type NoCamada } from '@/lib/mae/schema'
import { montarBaseDeMedidas } from '@/lib/mae/medidas/pecas'
import { organizarFolha, distribuirKit, docDoKit } from '@/lib/mae/editor/folhaMontada'
import { resolverPrancheta, temaDaVaga } from '@/lib/mae/vinculo/resolver'
import { textosRepetidos, limparTextosIdenticos, noMesmoLugar, chaveDoPar } from '@/lib/mae/vinculo/textosDoTema'
import { tipoDeProduto } from '@/lib/mae/pedidos/ordemLote'
import { sugereDoisNomes, alternarNomesNoDoc, valoresDoNome2, nomesJuntos } from '@/lib/mae/pedidos/doisNomes'
import { doisNomesDe, aplicarAjustes, ajustesParaTela } from '@/lib/mae/servidor/ajustesPedido'
import { nomeTemaPronto } from '@/lib/mae/exportar/nomes'
import { casarPaginas } from '@/lib/mae/temasProntos/montar'
import { reguasDaPeca, ajusteDaFaca } from '@/lib/mae/exportar/reguaFaca'
import { abrirFonte, type FonteHB } from '@/lib/mae/texto/fonte'

let fonte: FonteHB
beforeAll(async () => { fonte = await abrirFonte(readFileSync(join(process.cwd(), 'public/mae/fontes/Sniglet-Regular.ttf'))) })
const texto = (valoresPorSlot?: Record<string, Record<string, string>>) => ({ fontes: { obter: () => fonte, substituta: fonte }, valores: { _PEDIDO: '1' }, valoresPorSlot })
const tema = (id: string, extra: Record<string, unknown> = {}) => DocTema.parse({ schemaVersion: 1, type: 'theme', id, version: 1, name: id, baseId: 'b', baseVersion: 1, partContent: {}, ...extra })

function nutella(): { d: DocTrabalho; corpo: string; tampa: string; f1: FolhaMontada; f2: FolhaMontada; face: string } {
  const d = novoDocumento('A4')
  montarBaseDeMedidas(d, [{ nome: 'Nutella · Corpo', medida: { forma: 'retangulo', larguraMm: 200, alturaMm: 35 } }, { nome: 'Nutella · Tampa', medida: { forma: 'circulo', larguraMm: 57, alturaMm: 57 } }])
  const [corpo, tampa] = d.molds.map(m => m.id)
  const fol = { widthMm: 210, heightMm: 297, espacoMm: 0, margemMm: 5 }
  const f1: FolhaMontada = { id: 'f1', nome: 'frente', ...fol, pecas: organizarFolha(fol, [{ moldeId: corpo, quantidade: 5 }], d.molds).pecas.slice(0, 5) }
  const f2: FolhaMontada = { id: 'f2', nome: 'tampa', ...fol, pecas: organizarFolha(fol, [{ moldeId: tampa, quantidade: 12 }], d.molds).pecas.slice(0, 12) }
  d.folhas = [f1, f2]
  const face = d.molds[0].faces.find(x => !x.hole)!.id
  d.textSlots.push({ id: 'ts_ni', variable: 'NOME_IDADE', faceId: face, box: { x: 0.5, y: 0.2, w: 0.3, h: 0.6 }, single: { lines: 1, sizePt: 16 } } as never)
  return { d, corpo, tampa, f1, f2, face }
}
/** Os nós de uma pessoa, sem a posição na folha (o encaixe da arte e o texto têm de ser iguais). */
function nosDe(kd: ReturnType<typeof docDoKit>, quem: string): string[] {
  const out: string[] = []
  const norm = (n: Record<string, unknown>, suf: string): unknown => Object.fromEntries(Object.entries(n).filter(([k]) => !['rings', 'xMm', 'yMm', 'd'].includes(k)).map(([k, v]) => [k,
    k === 'matrix' ? (v as number[]).slice(0, 4).map(x => Math.round(x * 1000) / 1000)
      : k === 'bboxMm' ? [Math.round(((v as number[])[2] - (v as number[])[0]) * 100), Math.round(((v as number[])[3] - (v as number[])[1]) * 100)]
        : k === 'children' ? (v as Record<string, unknown>[]).map(c => norm(c, suf)) : typeof v === 'string' ? v.split(suf).join('~X') : v]))
  for (const ab of kd.artboardIds) {
    const sufs = new Set(Object.entries(kd.valoresPorSlot).filter(([, v]) => v.NOME === quem).map(([k]) => k.split('~')[1]))
    for (const n of resolverPrancheta(kd.doc, ab, { tema: kd.tema, modo: 'impressao', sobraMm: 0, texto: texto(kd.valoresPorSlot) }) as NoCamada[]) {
      const s = [...sufs].find(x => n.id.includes(`~${x}`)); if (s) out.push(JSON.stringify(norm(n as never, `~${s}`)))
    }
  }
  return out.sort()
}

describe('231 — o LOTE sai idêntico ao gerar sozinho (arte, fontes e estilos do tema de cada pedido)', () => {
  it('Antonella (Moana) junto com o Antonny (Pooh, 1º pedido): os nós dela são os mesmos de quando sai sozinha', () => {
    const { d, corpo, tampa, f1, f2 } = nutella()
    const img = (p: string) => ({ path: `Temas/${p}.png`, sha256: 'abcd', aspect: 200 / 35 })
    const moana = tema('th_moana', { pecasProntas: { [corpo]: img('moana') }, idade: { formato: 'aninhos', caixa: 'maiusculas' },
      textStyles: { NOME_IDADE: { font: { postscriptName: 'MoanaFonte' }, color: '#44fec2' }, 'NOME_IDADE:IDADE': { font: { postscriptName: 'MoanaIdade' }, color: '#ff00aa' } } })
    const pooh = tema('th_pooh', { pecasProntas: { [corpo]: img('pooh') }, textStyles: { NOME_IDADE: { font: { postscriptName: 'PoohFonte' }, color: '#ffcc00' } } })
    const kit = [{ folha: f1, impressoes: 1 }, { folha: f2, impressoes: 1 }], comp = [{ moldeId: corpo, qtd: 1 }, { moldeId: tampa, qtd: 1 }]
    const A = { rotulo: 'A', valores: { NOME: 'Antonella', IDADE: '2', _PEDIDO: '1' } }, B = { rotulo: 'B', valores: { NOME: 'Antonny', IDADE: '1', _PEDIDO: '1' } }
    const sozinha = docDoKit(d, moana, distribuirKit(kit, [{ kits: 1, pecas: 0 }], 'composicao', false, comp), [A])
    const lote = docDoKit(d, pooh, distribuirKit(kit, [{ kits: 1, pecas: 0 }, { kits: 1, pecas: 0 }], 'composicao', true, comp), [B, A], [pooh, moana])
    const a = nosDe(sozinha, 'Antonella'), b = nosDe(lote, 'Antonella')
    expect(a.length).toBeGreaterThan(1)
    expect(b).toEqual(a)
    expect(b.join()).toContain('#ff00aa')   // a idade com o estilo do Moana (antes: o do 1º pedido)
  })
  it('temaDaVaga: estilos, formato da idade e hashtag vêm da vaga (sem eles, do tema)', () => {
    const t = tema('t', { textStyles: { NOME: { font: { postscriptName: 'X' }, color: '#000000' } }, idade: { formato: 'anos', caixa: 'maiusculas' } })
    expect(temaDaVaga(t, {}).idade?.formato).toBe('anos')
    const v = temaDaVaga(t, { _ESTILOS_TEMA: JSON.stringify({ NOME: { color: '#ff0000' } }), _IDADE_TEMA: JSON.stringify({ formato: 'aninhos', caixa: 'minusculas' }), _HASHTAG_MEIO: 'curte' })
    expect((v.textStyles.NOME as { color: string }).color).toBe('#ff0000'); expect(v.idade?.formato).toBe('aninhos'); expect(v.hashtagMeio).toBe('curte')
  })
})

describe('241 — nome e idade juntos (a altura da área é só o limite)', () => {
  it('numa área alta, a idade fica logo abaixo do nome e o bloco fica no meio', () => {
    const { d, face } = nutella()
    d.textSlots = [{ id: 'ts_ni', variable: 'NOME_IDADE', faceId: face, box: { x: 0.1, y: 0.05, w: 0.8, h: 0.9 }, single: { lines: 1, sizePt: 10 } } as never]
    const nos = resolverPrancheta(d, d.molds[0].artboardId, { tema: tema('t'), texto: { fontes: { obter: () => fonte, substituta: fonte }, valores: { NOME: 'Ana', IDADE: '3', _PEDIDO: '1' } } }) as (NoCamada & { bboxMm?: number[] })[]
    const nome = nos.find(n => n.id === 'ts_ni:texto')!, idade = nos.find(n => n.id === 'ts_ni:idade:texto')!
    const vao = idade.bboxMm![1] - nome.bboxMm![3]
    expect(vao).toBeGreaterThanOrEqual(-0.5)
    expect(vao).toBeLessThan(4)                       // antes: o nome no topo e a idade no pé da área (~20 mm)
  })
})

describe('233/243 — textos no mesmo lugar', () => {
  it('só avisa quando estão no mesmo lugar (±2 mm); faces diferentes nunca; "está certo assim" cala o aviso', () => {
    const { d, face } = nutella()
    const s = (id: string, y: number, f = face) => ({ id, variable: 'NOME', faceId: f, box: { x: 0.2, y, w: 0.6, h: 0.2 }, single: { lines: 1, sizePt: 12 } }) as DocTrabalho['textSlots'][number]
    d.textSlots = [s('a', 0.1), s('b', 0.12), s('c', 0.6)]
    expect(noMesmoLugar(d, d.textSlots[0], d.textSlots[1])).toBe(true)
    expect(noMesmoLugar(d, d.textSlots[0], d.textSlots[2])).toBe(false)
    const r = textosRepetidos(d)
    expect(r.map(x => [x.manter.id, x.repetidos.map(y => y.id)])).toEqual([['a', ['b']]])
    expect(textosRepetidos({ ...d, textosRepetidosOk: [chaveDoPar(d.textSlots[0], d.textSlots[1])] })).toEqual([])
  })
  it('texto IDÊNTICO (um em cima do outro, igualzinho) sai sozinho', () => {
    const { d, face } = nutella()
    const s = { variable: 'NOME', faceId: face, box: { x: 0.2, y: 0.1, w: 0.6, h: 0.2 }, single: { lines: 1, sizePt: 12 } }
    d.textSlots = [{ id: 'a', ...s }, { id: 'b', ...s }, { id: 'c', ...s, box: { ...s.box, y: 0.5 } }] as never
    expect(limparTextosIdenticos(d)).toBe(1)
    expect(d.textSlots.map(x => x.id)).toEqual(['a', 'c'])
  })
})

describe('235 — o tipo de produto do lote é a BASE (nunca o título do anúncio)', () => {
  it('nome curto pela base (ou o grupo do produto)', () => {
    expect(tipoDeProduto('kit festa_spidey e seus amigos_editavel v4')).toBe('kit festa')
    expect(tipoDeProduto('Rótulo Nutella - ARTE PRONTA')).toBe('Rótulo Nutella')
    expect(tipoDeProduto('qualquer', 'Pegue e monte')).toBe('Pegue e monte')
    expect(tipoDeProduto('kit festa_moana_editavel v4')).toBe(tipoDeProduto('kit festa_sonic_editavel v2'))   // mesma base → mesmo PDF
  })
})

describe('237 — dois nomes no mesmo pedido', () => {
  it('só SUGERE com dois nomes próprios — "Maitê e a idade e 2 anos" é um nome só', () => {
    expect(sugereDoisNomes('Ayla Maria e Aylin Maria')).toEqual(['Ayla Maria', 'Aylin Maria'])
    expect(sugereDoisNomes('Ayla Maria e Aylin Maria. 1 ano')).toEqual(['Ayla Maria', 'Aylin Maria'])
    expect(sugereDoisNomes('Maitê e a idade e 2 anos')).toBeNull()
    expect(sugereDoisNomes('Maria Júlia')).toBeNull()
    expect(sugereDoisNomes('João & Pedro')).toEqual(['João', 'Pedro'])
  })
  it('"um em cada face": as faces de nome alternam Nome 1 / Nome 2 (com a idade de cada um)', () => {
    const doc = { artboards: [{ id: 'ab' }], molds: [{ id: 'm', artboardId: 'ab', faces: [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }] }],
      textSlots: [{ id: 's1', faceId: 'f1', variable: 'NOME' }, { id: 's2', faceId: 'f2', variable: 'NOME_IDADE' }, { id: 's2i', faceId: 'f2', variable: 'IDADE' }, { id: 's3', faceId: 'f3', variable: 'NOME' }] }
    const dn = { nome1: 'Ayla Maria', idade1: '1', nome2: 'Aylin Maria', idade2: '3', modo: 'faces' as const }
    const vps = alternarNomesNoDoc(doc, { NOME: 'Ayla Maria', IDADE: '1' }, dn)
    expect(Object.keys(vps).sort()).toEqual(['s2', 's2i'])
    expect(vps.s2).toMatchObject({ NOME: 'Aylin Maria', IDADE: '3' })
    expect(valoresDoNome2({ NOME: 'x', IDADE: '1' }, { ...dn, idade2: undefined }).IDADE).toBe('1')   // gêmeas: a idade 2 = a 1
  })
  it('"juntos", o arquivo com os dois nomes e o _mae.doisNomes saneado', () => {
    expect(nomesJuntos({ nome1: 'Ayla', nome2: 'Aylin', modo: 'juntos', conector: '♥' })).toBe('Ayla ♥ Aylin')
    expect(nomeTemaPronto({ nome: 'Ayla Maria', nome2: 'Aylin Maria', idade: '1', tema: 'Bosque', data: new Date(), extensao: 'pdf' })).toMatch(/^Ayla-Maria_Aylin-Maria_1ano/)
    expect(doisNomesDe({ doisNomes: { nome1: ' Ayla ', nome2: 'Aylin', modo: 'xx' } })).toEqual({ nome1: 'Ayla', nome2: 'Aylin', modo: 'faces' })
    const mae = aplicarAjustes({}, { doisNomes: { nome1: 'A', nome2: 'B', modo: 'juntos' } })
    expect(ajustesParaTela(mae).doisNomes?.modo).toBe('juntos')
    expect(ajustesParaTela(aplicarAjustes(mae, { doisNomes: null })).doisNomes).toBeNull()
  })
})

describe('240 — tema pronto: a página escolhe a caixa', () => {
  const base = { artboards: [{ id: 'a1', name: 'sacola P_molde', widthMm: 295, heightMm: 211 }], molds: [{ id: 'm', name: 'sacola P_molde', artboardId: 'a1', faces: [] }] } as never
  it('base com UMA caixa liga a página sozinha (mesmo com outro nome)', () => {
    const c = casarPaginas([{ nome: 'SACOLA PP SEM NOME_STITCH', wMm: 296.9, hMm: 210 }], base)
    expect(c.pares.map(p => p.artboardId)).toEqual(['a1']); expect(c.semPrancheta).toEqual([])
    expect(c.tamanhoDiferente).toHaveLength(1)   // 296,9 × 210 contra 295 × 211: avisa e oferece ajustar/preencher
  })
  it('o seletor manda (inclusive "fica de fora")', () => {
    expect(casarPaginas([{ nome: 'x', wMm: 100, hMm: 100 }], base, { 0: null }).pares).toEqual([])
  })
})

describe('236 — corte com faca', () => {
  it('as réguas: 4 lados, o 0 em cima da linha de corte, número a cada 1 mm (−5 a +5)', () => {
    const r = reguasDaPeca({ x: 10, y: 20, w: 50, h: 30 })
    expect(r.textos.filter(t => t.texto === '0')).toHaveLength(4)
    expect(r.textos).toHaveLength(4 * 11)
    expect(r.textos.find(t => t.texto === '0' && Math.abs(t.xMm - 10) < 1e-6)).toBeTruthy()   // o 0 da esquerda na linha x = 10
  })
  it('"onde a faca cortou": esq +2 / dir +2 = a arte anda 2 mm para a direita; soma ao ajuste que já existe', () => {
    expect(ajusteDaFaca({ esq: 2, dir: 2, topo: -1, base: null })).toEqual({ xMm: 2, yMm: -1 })
    expect(ajusteDaFaca({ esq: 1, dir: null }, { xMm: 2, yMm: 0.5 })).toEqual({ xMm: 3, yMm: 0.5 })
    expect(ajusteDaFaca({})).toBeNull()
  })
})
