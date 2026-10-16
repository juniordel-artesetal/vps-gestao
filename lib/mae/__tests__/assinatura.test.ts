// Monetização do Método Mãe (12/10/2026): preços da config (4 preços), venda fechada sem flag/preço, anual em até
// 12× com juros Price do cliente, economia do anual, acesso (cortesia/assinatura/carência/SOA Design) e datas.
import { describe, it, expect } from 'vitest'
import { precosMae, vendaMaeAtiva, cobrancaMae, tabelaAnualMae, economiaAnual, acessoMae, somarDias, proximoDoCiclo, ehRefAssinaturaMae, refAssinaturaMae, TRIAL_DIAS_MAE } from '@/lib/mae/assinatura/precos'
import { calcularParcelamentoAnual } from '@/lib/assinatura/planos'

const ENV = { MAE_ADDON_MENSAL: '39.90', MAE_ADDON_ANUAL: '383,00', MAE_STANDALONE_MENSAL: '59.90', MAE_STANDALONE_ANUAL: '503' }

describe('preços em config', () => {
  it('lê os 4 preços (ponto ou vírgula); faltando um, nada é vendido', () => {
    expect(precosMae(ENV)).toEqual({ addon: { mensal: 39.9, anual: 383 }, standalone: { mensal: 59.9, anual: 503 } })
    expect(precosMae({ ...ENV, MAE_STANDALONE_ANUAL: '' })).toBeNull()
    expect(precosMae({ ...ENV, MAE_ADDON_MENSAL: 'abc' })).toBeNull()
  })
  it('venda aberta só com MAE_VENDA_ATIVO=on E os preços', () => {
    const depois = new Date('2026-10-16T23:00:00Z'), antes = new Date('2026-10-16T22:59:59Z')
    expect(vendaMaeAtiva({ ...ENV, MAE_VENDA_ATIVO: 'on' }, depois)).toBe(true)
    // Lançamento: com tudo ligado, só abre às 20h de 16/10 (Brasília)
    expect(vendaMaeAtiva({ ...ENV, MAE_VENDA_ATIVO: 'on' }, antes)).toBe(false)
    expect(vendaMaeAtiva({ ...ENV, MAE_VENDA_ATIVO: 'on', MAE_LANCAMENTO_EM: '2026-10-01T00:00:00Z' }, antes)).toBe(true)
    expect(vendaMaeAtiva(ENV)).toBe(false)
    expect(vendaMaeAtiva({ MAE_VENDA_ATIVO: 'on' })).toBe(false)
  })
})

describe('cobrança: mensal simples, anual em até 12× com juros do cliente', () => {
  const p = precosMae(ENV)!
  it('mensal = o preço; anual 1× = à vista sem juros', () => {
    expect(cobrancaMae(p, 'addon', 'mensal', 12)).toEqual({ parcelas: 1, valorParcela: 39.9, total: 39.9 })
    expect(cobrancaMae(p, 'standalone', 'anual', 1)).toEqual({ parcelas: 1, valorParcela: 503, total: 503 })
  })
  it('anual 12× = mesma tabela Price do anual do SOA (o item já vai com os juros)', () => {
    const c = cobrancaMae(p, 'addon', 'anual', 12)
    expect(c).toEqual(calcularParcelamentoAnual(12, 383))
    expect(c.total).toBeGreaterThan(383); expect(Math.abs(c.valorParcela * 12 - c.total)).toBeLessThan(0.01)
    expect(cobrancaMae(p, 'addon', 'anual', 40).parcelas).toBe(12)
    expect(tabelaAnualMae(p, 'standalone').length).toBe(12)
  })
  it('economia do anual: add-on ~20%, standalone ~30%', () => {
    expect(economiaAnual(p, 'addon')).toBe(20)
    expect(economiaAnual(p, 'standalone')).toBe(30)
  })
})

describe('acesso ao MAE', () => {
  const hoje = '2026-10-12'
  const e = (o: Partial<Parameters<typeof acessoMae>[0]>) => ({ moduloMae: false, origem: null, ate: null, soaDesign: false, ...o })
  it('cortesia é imune a data; assinatura vale até moduloMaeAte; SOA Design vira cortesia; sem nada = sem acesso', () => {
    expect(acessoMae(e({ moduloMae: true, origem: 'cortesia', ate: '2020-01-01' }), hoje)).toBe('cortesia')
    expect(acessoMae(e({ moduloMae: true, origem: 'asaas', ate: '2026-10-12' }), hoje)).toBe('asaas')
    expect(acessoMae(e({ moduloMae: true, origem: 'asaas', ate: '2026-10-11' }), hoje)).toBeNull()
    expect(acessoMae(e({ soaDesign: true }), hoje)).toBe('soa-design')
    expect(acessoMae(e({}), hoje)).toBeNull()
  })
  it('datas: sem teste grátis (TRIAL_DIAS_MAE = 0), próximo vencimento mensal/anual, referência MAEA (≠ MAE: da Loja)', () => {
    expect(TRIAL_DIAS_MAE).toBe(0)
    expect(somarDias('2026-10-12', 7)).toBe('2026-10-19')
    expect(somarDias('2026-12-28', 5)).toBe('2027-01-02')
    expect(proximoDoCiclo('2026-10-19', 'mensal')).toBe('2026-11-19')
    expect(proximoDoCiclo('2026-10-19', 'anual')).toBe('2027-10-19')
    expect(ehRefAssinaturaMae(refAssinaturaMae('ws1'))).toBe(true)
    expect(ehRefAssinaturaMae('MAE:ws1:pack:x:y')).toBe(false)
  })
})
