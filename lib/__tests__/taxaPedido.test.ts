// Taxa do PEDIDO por item (Shopee 2026): comissão e taxa fixa por unidade vendida, cada item na
// faixa do seu preço; < R$8 paga 50% do preço no lugar da fixa; kit = 1 item por kit.
import { describe, it, expect } from 'vitest'
import { resolverTaxaLocal, unidadesDoPedido, taxaDoPedido, taxaFixaDoItem, CATALOGO_SEED, type CanalCatalogoRow, type CanalVendaRow } from '@/lib/canaisVendaCalc'

const catalogo: CanalCatalogoRow[] = CATALOGO_SEED.map(c => ({ canal: c.canal, nome: c.nome, regras: c.regras, categorias: [], variantes: [], pixDias: c.pixDias, cartaoDias: c.cartaoDias, estrutura: null, atualizadoEm: null, atualizadoPor: null }))
const shopee = (canaisWs: CanalVendaRow[] = []) => (preco: number) => resolverTaxaLocal(canaisWs, catalogo, 'Shopee', preco)
const pedido = (valor: number, qtd: number, produtos?: { quantidade: number; valorUnitario?: number | null; variacaoId?: string }[], kits: Record<string, number> = {}) =>
  taxaDoPedido(unidadesDoPedido(valor, qtd, produtos, id => kits[id] ?? 1), shopee())

describe('Shopee: taxa fixa POR ITEM', () => {
  it('3 itens de R$30 → 3 × (20% + R$4) = R$30 (antes: 14% + R$16 na faixa do total)', () => {
    const t = pedido(90, 3, [{ quantidade: 3, valorUnitario: 30 }])
    expect(t.taxaFixa).toBe(12); expect(t.taxaValor).toBe(30); expect(t.liquido).toBe(60); expect(t.itens).toBe(3)
    expect(t.taxaPercent).toBe(20)
  })
  it('faixas mistas: R$50 (20% + R$4) + R$150 (14% + R$20) = R$55', () => {
    const t = pedido(200, 2, [{ quantidade: 1, valorUnitario: 50 }, { quantidade: 1, valorUnitario: 150 }])
    expect(t.taxaFixa).toBe(24); expect(t.taxaValor).toBe(10 + 4 + 21 + 20)
  })
  it('1 item: igual ao cálculo antigo (% + fixa uma vez)', () => {
    expect(pedido(50, 1).taxaValor).toBe(14)                 // 20% de 50 + 4
    expect(pedido(120, 1).taxaValor).toBe(36.8)              // 14% de 120 + 20
    expect(pedido(250, 1, [{ quantidade: 1, valorUnitario: 250 }]).taxaValor).toBe(61)
  })
  it('item < R$8 paga 50% do preço no lugar da fixa (também na precificação)', () => {
    expect(taxaFixaDoItem('shopee', 6, 4)).toBe(3); expect(taxaFixaDoItem('shopee', 8, 4)).toBe(4)
    expect(taxaFixaDoItem('mercadolivre', 6, 4)).toBe(4)
    expect(shopee()(5).taxaFixa).toBe(2.5)
    const t = pedido(30, 5, [{ quantidade: 5, valorUnitario: 6 }])    // 5 × (1,20 + 3,00)
    expect(t.taxaValor).toBe(21); expect(t.taxaFixa).toBe(15)
  })
  it('kit conta 1 item por kit (quantidade gravada em peças)', () => {
    // 2 kits de 6 peças a R$60 cada → 2 × (20% de 60 + 4) = 32 — não 12 × fixa
    const porKit = pedido(120, 12, [{ quantidade: 12, valorUnitario: 60, variacaoId: 'k' }], { k: 6 })
    expect(porKit.itens).toBe(2); expect(porKit.taxaValor).toBe(32)
    const porPeca = pedido(120, 12, [{ quantidade: 12, valorUnitario: 10, variacaoId: 'k' }], { k: 6 })   // valor por peça (importação)
    expect(porPeca.taxaValor).toBe(32)
  })
  it('sem produtos: divide pela quantidade do pedido; sem valor unitário: divide por unidade', () => {
    expect(pedido(90, 3).taxaValor).toBe(30)
    expect(pedido(90, 3, [{ quantidade: 3 }]).taxaValor).toBe(30)
  })
  it('canal personalizado da artesã segue por pedido (fixa uma vez)', () => {
    const custom: CanalVendaRow[] = [{ canal: 'shopee', nome: 'Minha Shopee', origem: 'custom', taxaPercent: 10, taxaFixa: 5, pixDias: 0, cartaoDias: 0 } as CanalVendaRow]
    const t = taxaDoPedido(unidadesDoPedido(90, 3, [{ quantidade: 3, valorUnitario: 30 }]), shopee(custom))
    expect(t.taxaValor).toBe(14)
  })
})
