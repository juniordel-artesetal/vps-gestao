// Regras do anúncio TikTok Shop (Create Product 202309) — respostas no formato da API real.
import { describe, it, expect } from 'vitest'
import { checarCategoria, montarAtributos, checarRegras, descricaoHtml, montarSkus, baseSku, avisosAnuncio, caminhoCategoria } from '@/lib/tiktok/regrasProduto'

const cats = [
  { id: '600001', parent_id: '0', local_name: 'Casa e Decoração', is_leaf: false },
  { id: '600002', parent_id: '600001', local_name: 'Papelaria', is_leaf: false },
  { id: '600003', parent_id: '600002', local_name: 'Agendas e Planners', is_leaf: true },
]
const attrs = [
  { id: '100198', name: 'Marca do material', type: 'PRODUCT_PROPERTY', is_requried: true, is_customizable: false, values: [{ id: '1001', name: 'Papel' }, { id: '1002', name: 'Couro' }] },
  { id: '100347', name: 'Tamanho', type: 'PRODUCT_PROPERTY', is_requried: true, is_customizable: true, values: [{ id: '2001', name: 'A5' }] },
  { id: '100500', name: 'Tema', type: 'PRODUCT_PROPERTY', is_requried: false, is_multiple_selection: true, values: [] },
  { id: '100000', name: 'Cor', type: 'SALES_PROPERTY', is_requried: true, values: [] },
]

describe('categoria', () => {
  it('folha passa com o caminho; categoria-mãe, texto e id inexistente são barrados', () => {
    expect(checarCategoria(cats, '600003')).toEqual({ ok: true, nome: 'Casa e Decoração > Papelaria > Agendas e Planners' })
    const mae = checarCategoria(cats, '600002'); expect(mae.ok).toBe(false); expect(!mae.ok && mae.erro).toMatch(/categoria-mãe/)
    const txt = checarCategoria(cats, 'agenda'); expect(!txt.ok && txt.erro).toMatch(/não é um ID/)   // o erro real de 11/09 ("convertible to Int64")
    expect(checarCategoria(cats, '999').ok).toBe(false)
    expect(checarCategoria(cats, undefined).ok).toBe(false)
    expect(caminhoCategoria(cats, '600002')).toBe('Casa e Decoração > Papelaria')
  })
})

describe('atributos da categoria', () => {
  it('obrigatório vazio → faltando; atributo de VENDA não entra; valor da lista vai por id', () => {
    const r = montarAtributos(attrs, { '100198': 'papel' })
    expect(r.faltando).toEqual(['Tamanho'])
    expect(r.product_attributes).toEqual([{ id: '100198', values: [{ id: '1001' }] }])
  })
  it('customizável aceita texto livre; múltiplo separa por ;', () => {
    const r = montarAtributos(attrs, { '100198': 'Couro', '100347': '15x21 cm', '100500': 'Safari; Fundo do mar' })
    expect(r.faltando).toEqual([]); expect(r.invalidos).toEqual([])
    expect(r.product_attributes).toContainEqual({ id: '100347', values: [{ name: '15x21 cm' }] })
    expect(r.product_attributes).toContainEqual({ id: '100500', values: [{ name: 'Safari' }, { name: 'Fundo do mar' }] })
  })
  it('valor fora da lista fechada é inválido (com exemplos); atributo de outra categoria é ignorado', () => {
    const r = montarAtributos(attrs, { '100198': 'Plástico', '100347': 'A5', '777': 'x' })
    expect(r.invalidos[0]).toMatch(/Marca do material: "Plástico".*Papel, Couro/)
    expect(r.product_attributes.find(a => a.id === '777')).toBeUndefined()
    expect(r.product_attributes).toContainEqual({ id: '100347', values: [{ id: '2001' }] })
  })
})

describe('regras da categoria', () => {
  it('tabela de medidas, certificação e dimensões obrigatórias', () => {
    expect(checarRegras({ size_chart: { is_required: true } }, true)[0]).toMatch(/tabela de medidas/)
    expect(checarRegras({ product_certifications: [{ id: '1', name: 'INMETRO', is_required: true }, { id: '2', name: 'X', is_required: false }] }, true)[0]).toMatch(/INMETRO/)
    expect(checarRegras({ package_dimension: { is_required: true } }, false)).toHaveLength(1)
    expect(checarRegras({ package_dimension: { is_required: true } }, true)).toHaveLength(0)
    expect(checarRegras(null, false)).toEqual([])
  })
})

describe('descrição e SKUs', () => {
  it('texto vira HTML escapado (≤10.000); HTML pronto passa; vazio usa o título', () => {
    expect(descricaoHtml('Agenda A5\nCapa dura <linda>', 't')).toBe('<p>Agenda A5</p><p>Capa dura &lt;linda&gt;</p>')
    expect(descricaoHtml('<p>ok</p>', 't')).toBe('<p>ok</p>')
    expect(descricaoHtml('', 'Agenda')).toBe('<p>Agenda</p>')
    expect(descricaoHtml('a'.repeat(20000), 't').length).toBeLessThanOrEqual(10000)
  })
  it('seller_sku único por variação; 1 variação sem sales_attributes; preço com 2 casas e warehouse', () => {
    const um = montarSkus([{ variacaoId: 'v1', nome: 'Padrão', preco: 89.9, estoque: 7 }], 'AGD-A5', 'WH1')
    expect(um[0].sku).toEqual({ seller_sku: 'AGD-A5', price: { amount: '89.90', currency: 'BRL' }, inventory: [{ quantity: 7, warehouse_id: 'WH1' }] })
    const dois = montarSkus([{ variacaoId: 'v1', nome: 'Rosa', preco: 10, estoque: 1 }, { variacaoId: 'v2', nome: 'rosa', preco: 12, estoque: 0 }], 'AGD', 'WH1', '7891234567895')
    expect(dois.map(s => s.sku.seller_sku)).toEqual(['AGD-1', 'AGD-2'])
    expect(dois[1].sku.sales_attributes?.[0].value_name).not.toBe('rosa')        // valor repetido ganha sufixo
    expect(dois[0].sku.identifier_code).toEqual({ code: '7891234567895', type: 'GTIN' })
    expect(dois.map(s => s.variacaoId)).toEqual(['v1', 'v2'])
    expect(baseSku(null, 'abcdefghij')).toBe('SOA-ABCDEFGH'); expect(baseSku(' AG 01 ', 'x')).toBe('AG-01')
  })
  it('avisos: menos de 5 fotos e estoque zero', () => {
    expect(avisosAnuncio(2, 0)).toHaveLength(2); expect(avisosAnuncio(5, 3)).toEqual([])
  })
})
