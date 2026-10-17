// Plano Alunas VPS · Método Mãe (16/10/2026): preços, desconto proporcional do anual, validade, nomes no Asaas.
import { describe, it, expect } from 'vitest'
import { precoAlunas, precosAlunas, alunasAberta, fimAlunas, nomeDoItemAlunas, descricaoDoItemAlunas } from '@/lib/mae/assinatura/alunas'
import { cobrancaMae } from '@/lib/mae/assinatura/precos'

describe('Plano Alunas', () => {
  it('R$ 49,90/mês; anual R$ 419 = o mesmo desconto do anual do "só o MAE" (503 / 12×59,90 ≈ 30%)', () => {
    const p = precoAlunas({})
    expect(p).toEqual({ mensal: 49.9, anual: 419 })
    expect(Math.round((1 - 419 / (12 * 49.9)) * 100)).toBe(Math.round((1 - 503 / (12 * 59.9)) * 100))
  })
  it('vale para quem assina o SOA e para quem não assina; o anual parcela como os outros (tabela Price)', () => {
    const pr = precosAlunas({})
    expect(pr.addon).toEqual(pr.standalone)
    expect(cobrancaMae(pr, 'addon', 'mensal').total).toBe(49.9)
    const doze = cobrancaMae(pr, 'standalone', 'anual', 12)
    expect(doze.parcelas).toBe(12); expect(doze.total).toBeGreaterThan(419)
    expect(cobrancaMae(pr, 'standalone', 'anual', 1).total).toBe(419)
  })
  it('validade: até 31/10/2026 23h59 de Brasília', () => {
    expect(alunasAberta(new Date('2026-10-31T23:59:00-03:00'), {})).toBe(true)
    expect(alunasAberta(new Date('2026-11-01T00:00:30-03:00'), {})).toBe(false)
    expect(fimAlunas({ MAE_ALUNAS_ATE: 'lixo' }).toISOString()).toBe('2026-11-01T02:59:59.000Z')
  })
  it('no Asaas: nome ≤ 30 e descrição ≤ 150, dizendo que é o Plano Alunas', () => {
    expect(nomeDoItemAlunas('mensal').length).toBeLessThanOrEqual(30)
    expect(nomeDoItemAlunas('anual')).toMatch(/Alunas/)
    const d = descricaoDoItemAlunas('anual', cobrancaMae(precosAlunas({}), 'addon', 'anual', 12))
    expect(d.length).toBeLessThanOrEqual(150); expect(d).toMatch(/Plano Alunas/); expect(d).toMatch(/12x/)
  })
})
