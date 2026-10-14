// Lote 14 — P0 (187, 188) e a base do 189/190: folhas do kit, conta do pedido, marca em L, miolo da peça.
import { describe, it, expect } from 'vitest'
import { novoDocumento } from '@/lib/mae/schema/documento'
import { DocTema, type DocTrabalho, type FolhaMontada } from '@/lib/mae/schema'
import { novaPeca, montarBaseDeMedidas, aplicarEstrutura, ESTRUTURAS_PRONTAS, mioloDaMedida } from '@/lib/mae/medidas/pecas'
import { zonasDaMarca } from '@/lib/mae/exportar/marca'
import { organizarFolha, gradeFolha, vagasDoGabarito, distribuirKit, docDoKit, folhasDoKit, pecasPorKit, folhasPorKit, tamanhoPeca } from '@/lib/mae/editor/folhaMontada'
import { linhasDoMoldeNaFolha } from '@/lib/mae/exportar/linhas'

const tema0 = () => DocTema.parse({ schemaVersion: 1, type: 'theme', id: 'th', version: 1, baseId: 'b', baseVersion: 1, partContent: {} })
const TAG = { forma: 'circulo' as const, larguraMm: 40, alturaMm: 40, furo: { x: 0.5, y: 0.14, diametroMm: 3.5 } }

/** Folha A4 deitada com as marcas da Silhouette: quadrado em cima/esquerda e um "L" fino em cada outro canto. */
function marcaSilhouette(): { x: number; y: number; w: number; h: number }[] {
  const k = 4, W = 297, H = 210, w = W * k, h = H * k
  const rgba = new Uint8ClampedArray(w * h * 4)
  const pinta = (x0: number, y0: number, x1: number, y1: number) => { for (let y = y0 * k; y < y1 * k; y++) for (let x = x0 * k; x < x1 * k; x++) { const i = (y * w + x) * 4; rgba[i + 3] = 255 } }
  pinta(10, 10, 15, 15)                                   // quadrado
  pinta(267, 10, 287, 11); pinta(286, 10, 287, 30)        // L em cima/direita
  pinta(10, 199, 30, 200); pinta(10, 180, 11, 200)        // L embaixo/esquerda
  pinta(267, 199, 287, 200); pinta(286, 180, 287, 200)    // L embaixo/direita
  return zonasDaMarca(rgba, w, h, k)
}

describe('188 — 24 tags de 4 cm cabem na A4', () => {
  const doc = () => { const d = novoDocumento('A4'); d.molds.push(novaPeca('Tag', TAG, d.artboards[0].id)); return d }
  const folha = { widthMm: 297, heightMm: 210, espacoMm: 2, margemMm: 5 }
  it('a peça por medida mede o que diz a medida (40 × 40), não o arquivo', () => {
    const d = doc()
    expect(tamanhoPeca(d.molds[0], 0)).toEqual({ w: 40, h: 40 })
  })
  it('marca em "L": as zonas seguem as faixas de tinta (não o quadrado inteiro do canto)', () => {
    const z = marcaSilhouette()
    expect(z.length).toBeGreaterThanOrEqual(7)   // quadrado + 2 faixas em cada L
    expect(Math.max(...z.map(r => Math.min(r.w, r.h)))).toBeLessThan(10)
  })
  it('sem marca e com a marca da Silhouette: 24 tags (Preencher folha), ~62% da folha', () => {
    const d = doc(), id = d.molds[0].id
    expect(organizarFolha(folha, [{ moldeId: id, quantidade: 24 }], d.molds).pecas.length).toBe(24)
    const r = organizarFolha(folha, [{ moldeId: id, quantidade: 24 }], d.molds, marcaSilhouette())
    expect(r.pecas.length).toBe(24); expect(r.ficaram).toBe(0)
    expect(gradeFolha(folha, id, d.molds, marcaSilhouette()).length).toBe(24)
  })
})

describe('187 — gabarito importado liga as vagas à peça certa', () => {
  it('duas peças da mesma medida: fica a do produto (a que tem arte), não a primeira da base', () => {
    const d = novoDocumento('A4')
    const solta = novaPeca('Tag solta', TAG, d.artboards[0].id), doProduto = novaPeca('Tag do produto', TAG, d.artboards[0].id)
    d.molds.push(solta, doProduto)
    const contornos = [{ x: 10, y: 10, w: 40, h: 40 }, { x: 60, y: 10, w: 40, h: 40 }]
    expect(vagasDoGabarito(contornos, d.molds).pecas.every(p => p.moldeId === solta.id)).toBe(true)
    expect(vagasDoGabarito(contornos, d.molds, new Set([doProduto.id])).pecas.every(p => p.moldeId === doProduto.id)).toBe(true)
  })
})

describe('187/189/190 — kit de folhas e a conta do pedido', () => {
  const base = (): { d: DocTrabalho; f: FolhaMontada } => {
    const d = novoDocumento('A4')
    montarBaseDeMedidas(d, [{ nome: 'Tag', medida: TAG }])
    const id = d.molds[0].id
    const pecas = gradeFolha({ widthMm: 297, heightMm: 210, espacoMm: 2, margemMm: 5 }, id, d.molds)
    const f: FolhaMontada = { id: 'fm_tag', nome: 'Tags', widthMm: 297, heightMm: 210, espacoMm: 2, margemMm: 5, pecas }
    d.folhas = [f]
    return { d, f }
  }
  const paginas = (dist: number[][][]) => dist.reduce((s, x) => s + x.length, 0)
  it('por peças: 96 tags = 4 folhas; 48 = 2; 24 = 1; 30 = 2 (a 2ª com 6)', () => {
    const { f } = base()
    const k = [{ folha: f, impressoes: 1 }]
    expect(f.pecas.length).toBe(24)
    for (const [n, folhas] of [[96, 4], [48, 2], [24, 1], [30, 2]] as const) expect(paginas(distribuirKit(k, [{ kits: 1, pecas: n }], 'pecas').map(x => x.dist))).toBe(folhas)
    const d30 = distribuirKit(k, [{ kits: 1, pecas: 30 }], 'pecas')[0].dist
    expect(d30[1].length).toBe(6)
  })
  it('190 — aproveitar folhas: 30 + 18 tags = 2 folhas (cheia do 1º; a 2ª com 6 do 1º + 18 do 2º)', () => {
    const { f } = base()
    const d = distribuirKit([{ folha: f, impressoes: 1 }], [{ kits: 1, pecas: 30 }, { kits: 1, pecas: 18 }], 'pecas', true)[0].dist
    expect(d.length).toBe(2)
    expect(d[0].every(i => i === 0)).toBe(true)
    expect(d[1].filter(i => i === 0).length).toBe(6); expect(d[1].filter(i => i === 1).length).toBe(18)
  })
  it('1 unidade = 1 kit: kit de Folha 1 × 2 + Folha 2 × 3 → 1 kit = 5 folhas; 2 kits = 10, todas as Folhas 1 antes', () => {
    const d = novoDocumento('A4')
    montarBaseDeMedidas(d, [{ nome: 'Livros', medida: { forma: 'retangulo', larguraMm: 90, alturaMm: 50 } }, { nome: '5x2', medida: { forma: 'retangulo', larguraMm: 50, alturaMm: 20 } }])
    const [livros, peq] = d.molds
    const f1: FolhaMontada = { id: 'f1', nome: 'Folha 1', widthMm: 210, heightMm: 297, espacoMm: 2, margemMm: 5, pecas: organizarFolha({ widthMm: 210, heightMm: 297, espacoMm: 2, margemMm: 5 }, [{ moldeId: livros.id, quantidade: 4 }], d.molds).pecas, impressoes: 2 }
    const f2: FolhaMontada = { id: 'f2', nome: 'Folha 2', widthMm: 210, heightMm: 297, espacoMm: 2, margemMm: 5, pecas: organizarFolha({ widthMm: 210, heightMm: 297, espacoMm: 2, margemMm: 5 }, [{ moldeId: peq.id, quantidade: 30 }], d.molds).pecas, impressoes: 3 }
    d.folhas = [f1, f2]
    const grupo = { folhas: ['f1', 'f2'], moldes: [] as string[] }
    const kit = folhasDoKit(d, grupo)
    expect(folhasPorKit(kit)).toBe(5); expect(pecasPorKit(kit)).toBe(4 * 2 + 30 * 3)
    const um = docDoKit(d, tema0(), distribuirKit(kit, [{ kits: 1, pecas: 0 }], 'kit'), [{ rotulo: '#1', valores: { NOME: 'Ana' } }])
    expect(um.artboardIds.length).toBe(5)
    const dois = docDoKit(d, tema0(), distribuirKit(kit, [{ kits: 2, pecas: 0 }], 'kit'), [{ rotulo: '#1', valores: { NOME: 'Ana' } }])
    expect(dois.artboardIds.length).toBe(10)
    expect(dois.artboardIds.map(a => a.split('_')[1])).toEqual(['f1', 'f1', 'f1', 'f1', 'f2', 'f2', 'f2', 'f2', 'f2', 'f2'])
  })
  it('a arte entra em TODAS as vagas: cada cópia da peça está numa parte do tema, com o nome do pedido', () => {
    const { d } = base()
    d.textSlots.push({ id: 'ts_nome', variable: 'NOME', faceId: d.molds[0].faces.find(x => !x.hole)!.id, box: { x: 0.2, y: 0.4, w: 0.6, h: 0.3 }, single: { lines: 1, sizePt: 20 }, compound: { lines: 2, sizePt: 16, lineHeight: 0.9 }, autoFit: { minScale: 0.6 } } as never)
    const r = docDoKit(d, tema0(), distribuirKit(folhasDoKit(d, null), [{ kits: 1, pecas: 96 }], 'pecas'), [{ rotulo: '#7 · Guilherme', valores: { NOME: 'Guilherme', IDADE: '1' } }])
    expect(r.artboardIds.length).toBe(4)
    const copias = r.doc.molds.filter(m => m.id.includes('~'))
    expect(copias.length).toBe(96)
    const comParte = new Set(r.doc.parts.flatMap(p => p.instances.map(i => i.faceId)))
    expect(copias.every(m => m.faces.filter(x => !x.hole).every(x => comParte.has(x.id)))).toBe(true)
    expect(Object.values(r.valoresPorSlot).every(v => v.NOME === 'Guilherme')).toBe(true)
    expect(Object.keys(r.valoresPorSlot).length).toBe(96)
  })
  it('produto sem folha ligada mas com as peças numa folha → sai na folha (nunca peça por peça)', () => {
    const { d, f } = base()
    expect(folhasDoKit(d, { moldes: [d.molds[0].id] }).map(e => e.folha.id)).toEqual([f.id])
    expect(folhasDoKit({ ...d, tipo: 'medida' }, null).map(e => e.folha.id)).toEqual([f.id])
  })
})

describe('189.5 — fundo e miolo', () => {
  it('miolo no formato da peça com margem, ou outra forma; é arte (não muda o corte)', () => {
    const d = novoDocumento('A4')
    montarBaseDeMedidas(d, [{ nome: 'Tag', medida: { ...TAG, miolo: { forma: 'circulo', x: 0.5, y: 0.56, w: 0.7, h: 0.7 } } }])
    const m = d.molds[0]
    expect(m.faces.some(x => x.id.endsWith('_miolo'))).toBe(true)
    expect(d.parts.map(p => p.name)).toEqual(expect.arrayContaining(['FUNDO', 'MIOLO']))
    expect(linhasDoMoldeNaFolha(m).corte.length).toBe(2)   // contorno + furo, o miolo não é corte
    expect(mioloDaMedida({ forma: 'retangulo', larguraMm: 90, alturaMm: 50, miolo: { forma: 'mesma', margemMm: 4 } })!.map(p => p[0])).toContain(86)
    // tirar o miolo volta ao fundo inteiro
    ;(m as never as { medida: { miolo: unknown } }).medida.miolo = null
    aplicarEstrutura(d, ESTRUTURAS_PRONTAS[0])
    expect(d.molds[0].faces.some(x => x.id.endsWith('_miolo'))).toBe(false)
  })
})
