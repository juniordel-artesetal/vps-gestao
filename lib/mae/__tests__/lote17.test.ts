// Lote 17 (P0, itens 208/209) — o rótulo Nutella em produção: a QTD do pedido multiplica o "Kit de N peças" e cada
// peça (corpo, tampa) tem as suas partes.
import { describe, it, expect } from 'vitest'
import { novoDocumento } from '@/lib/mae/schema/documento'
import { DocTema, DocBase, type DocTrabalho, type FolhaMontada } from '@/lib/mae/schema'
import { montarBaseDeMedidas, aplicarEstrutura, garantirPartesPorPeca, ESTRUTURAS_PRONTAS } from '@/lib/mae/medidas/pecas'
import { organizarFolha, distribuirKit, docDaFolha, unidadesDoPedido } from '@/lib/mae/editor/folhaMontada'
import { migrarPartesDoTema } from '@/lib/mae/vinculo/partes'
import { resolverPrancheta } from '@/lib/mae/vinculo/resolver'

const tema = (extra: Record<string, unknown> = {}) => DocTema.parse({ schemaVersion: 1, type: 'theme', id: 'th', version: 1, baseId: 'b', baseVersion: 1, partContent: {}, ...extra })
const papel = (id: string, path: string) => ({ id, type: 'image', anchor: 'paper', path, sha256: 'abcd', aspect: 1, transform: { x: 0.5, y: 0.5, scale: 1, rotationDeg: 0 } })

function nutella(compartilhar = false): { d: DocTrabalho; corpo: string; tampa: string; f1: FolhaMontada; f2: FolhaMontada } {
  const d = novoDocumento('A4')
  if (compartilhar) (d as { partesCompartilhadas?: boolean }).partesCompartilhadas = true
  montarBaseDeMedidas(d, [{ nome: 'Nutella · Corpo', medida: { forma: 'retangulo', larguraMm: 200, alturaMm: 35 } }, { nome: 'Nutella · Tampa', medida: { forma: 'circulo', larguraMm: 57, alturaMm: 57, miolo: { forma: 'circulo', w: 0.6, h: 0.6 } } }])
  const [corpo, tampa] = d.molds.map(m => m.id)
  const fol = { widthMm: 210, heightMm: 297, espacoMm: 2, margemMm: 5 }
  const f1: FolhaMontada = { id: 'f1', nome: 'rótulo frente', ...fol, pecas: organizarFolha(fol, [{ moldeId: corpo, quantidade: 7 }], d.molds).pecas.slice(0, 7) }
  const f2: FolhaMontada = { id: 'f2', nome: 'rótulo tampa', ...fol, pecas: organizarFolha(fol, [{ moldeId: tampa, quantidade: 12 }], d.molds).pecas.slice(0, 12) }
  d.folhas = [f1, f2]
  return { d, corpo, tampa, f1, f2 }
}

describe('208 — a QTD do pedido multiplica o kit de N peças', () => {
  it('unidades = a QTD do pedido (senão as vendidas, senão 1)', () => {
    expect(unidadesDoPedido({ itens: [{ quantidade: 15, qtdVendida: 1 }] })).toBe(15)
    expect(unidadesDoPedido({ itens: [{ quantidade: null, qtdVendida: 3 }] })).toBe(3)
    expect(unidadesDoPedido({ itens: [{}] })).toBe(1)
  })
  it('1 corpo + 1 tampa por unidade: QTD 15 = corpo 7+7+1 · tampa 12+3 (5 folhas); 10 = 3; 20 = 5', () => {
    const { corpo, tampa, f1, f2 } = nutella()
    const kit = [{ folha: f1, impressoes: 1 }, { folha: f2, impressoes: 1 }], comp = [{ moldeId: corpo, qtd: 1 }, { moldeId: tampa, qtd: 1 }]
    const folhas = (q: number) => distribuirKit(kit, [{ kits: unidadesDoPedido({ itens: [{ quantidade: q, qtdVendida: 1 }] }), pecas: q }], 'composicao', false, comp).map(x => x.dist.map(s => s.length))
    expect(folhas(15)).toEqual([[7, 7, 1], [12, 3]])
    expect(folhas(10)).toEqual([[7, 3], [10]])
    expect(folhas(20)).toEqual([[7, 7, 6], [12, 8]])
  })
})

describe('209 — cada peça tem as suas partes', () => {
  it('Corpo · FUNDO, Tampa · FUNDO, Tampa · MIOLO — e com a faixa, Corpo · FAIXA/BASE', () => {
    const { d, corpo } = nutella()
    expect(d.parts.map(p => p.name)).toEqual(['Corpo · FUNDO', 'Tampa · FUNDO', 'Tampa · MIOLO'])
    aplicarEstrutura(d, ESTRUTURAS_PRONTAS[1], { peca: corpo })
    expect(d.parts.map(p => p.name)).toEqual(['Corpo · FUNDO', 'Corpo · FAIXA', 'Corpo · BASE', 'Tampa · FUNDO', 'Tampa · MIOLO'])
    expect(DocBase.safeParse(d).success).toBe(true)
  })
  it('o papel da Tampa · FUNDO não aparece no corpo (folha do corpo resolvida)', () => {
    const { d, f1 } = nutella()
    const fundoTampa = d.parts.find(p => p.name === 'Tampa · FUNDO')!.id, fundoCorpo = d.parts.find(p => p.name === 'Corpo · FUNDO')!.id
    const t = tema({ partContent: { [fundoTampa]: [papel('l_t', 'Papéis/medalhao.png')], [fundoCorpo]: [papel('l_c', 'Papéis/carros.png')] } })
    const fol = docDaFolha(d, t, f1)
    const nos = JSON.stringify(resolverPrancheta(fol.doc, fol.artboardId, { tema: fol.tema }))
    expect(nos).toContain('carros.png'); expect(nos).not.toContain('medalhao.png')
  })
  it('"usar o mesmo papel em todas as peças": por nome, como antes', () => {
    const { d } = nutella(true)
    expect(d.parts.map(p => p.name)).toEqual(['FUNDO', 'MIOLO'])
  })
  it('base ANTIGA (FUNDO de todas) → dividida ao abrir; o tema antigo ganha o conteúdo copiado (ids de camada novos, sem duplicar)', () => {
    const { d } = nutella(true)
    const fundo = d.parts.find(p => p.name === 'FUNDO')!.id
    delete (d as { partesCompartilhadas?: boolean }).partesCompartilhadas   // como as bases salvas antes do Lote 17
    expect(garantirPartesPorPeca(d)).toBe(true)
    expect(d.parts.map(p => p.name)).toEqual(['Corpo · FUNDO', 'Tampa · FUNDO', 'Tampa · MIOLO'])
    const div = (d as { partesDivididas?: Record<string, Record<string, string>> }).partesDivididas!
    expect(Object.keys(div)).toEqual([fundo])
    const ids = Object.values(div[fundo])
    expect(ids[0]).toBe(fundo)                                  // a 1ª peça (corpo) fica com a parte antiga
    expect(d.parts.some(p => p.id === ids[1])).toBe(true)        // a tampa ganhou a dela
    expect(garantirPartesPorPeca(d)).toBe(false)                 // de novo: nada muda
    const t = tema({ partContent: { [fundo]: [papel('l1', 'Papéis/medalhao.png')] } })
    expect(migrarPartesDoTema(d as never, t as never)).toBe(true)
    expect((t.partContent[ids[1]][0] as { path: string }).path).toBe('Papéis/medalhao.png')
    expect(t.partContent[ids[1]][0].id).not.toBe('l1')            // id de camada novo
    expect(migrarPartesDoTema(d as never, t as never)).toBe(false) // não duplica
  })
  it('Alt (só nesta peça) vale em todas as cópias da peça na folha', () => {
    const { d, f2 } = nutella()
    const face = d.molds[1].faces.find(f => f.id.endsWith('_miolo'))!.id
    const t = tema({ faceContent: { [face]: [papel('l_alt', 'Papéis/cinco.png')] } })
    const fol = docDaFolha(d, t, f2)
    const nos = resolverPrancheta(fol.doc, fol.artboardId, { tema: fol.tema })
    expect(JSON.stringify(nos).split('cinco.png').length - 1).toBe(12)
  })
})
