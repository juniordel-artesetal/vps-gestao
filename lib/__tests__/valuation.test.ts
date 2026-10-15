// Valuation da empresa (Master → Receitas): a conta é pura e responde aos números reais.
import { describe, it, expect } from 'vitest'
import { calcularValuation, metaNaData, PREMISSAS } from '@/lib/master/valuation'

const base = { hoje: new Date('2026-10-15T12:00:00Z'), mrr: 3934.61, ativos: 145, faturamentoAcumulado: 34421, faturamentoLiquidoAcumulado: 29877, gmvAcumulado: 1_573_651, gmv30d: 335_250, pedidos: 29753, pedidos30d: 6187, ateliers: 611, churnMensalObservado: 12 }

describe('valuation', () => {
  it('meta do roadmap na data: linha reta entre os fins de ano', () => {
    expect(metaNaData(new Date('2026-12-31T23:00:00Z'))).toBeCloseTo(350, 0)
    expect(Math.round(metaNaData(new Date('2027-07-02T00:00:00Z')))).toBeGreaterThan(900)
  })
  it('roadmap 2026–2030 com as metas do Júnior e verba 40/30/30', () => {
    const v = calcularValuation(base)
    expect(v.roadmap.map(r => r.assinantes)).toEqual([350, 1500, 3000, 5000, 8000])
    expect(v.roadmap[4].arr).toBe(Math.round(8000 * (PREMISSAS.ticketSoa + PREMISSAS.ticketMae) * 12))
    const u = v.captacao.uso
    expect(u.marketing.valor / v.captacao.valor).toBeCloseTo(0.4, 2)
    expect(u.desenvolvimento.valor + u.comercial.valor + u.marketing.valor).toBeCloseTo(v.captacao.valor, -1)
  })
  it('cenários ordenados e o valuation sobe com mais assinantes/MRR (fator de execução)', () => {
    const v = calcularValuation(base), mais = calcularValuation({ ...base, ativos: 280, mrr: 280 * 27.14 })
    expect(v.cenarios.conservador.valuation).toBeLessThan(v.cenarios.base.valuation)
    expect(v.cenarios.base.valuation).toBeLessThan(v.cenarios.otimista.valuation)
    expect(mais.valuationBase).toBeGreaterThan(v.valuationBase)
    expect(v.hoje.fatorExecucao).toBeGreaterThanOrEqual(0.5); expect(v.hoje.fatorExecucao).toBeLessThanOrEqual(1.2)
  })
  it('piso por tração vale quando a projeção é menor (ARR alto hoje)', () => {
    const v = calcularValuation({ ...base, mrr: 200_000, ativos: 5000 })
    expect(v.cenarios.base.valuation).toBe(Math.max(v.cenarios.base.piso, v.cenarios.base.vc))
  })
})
