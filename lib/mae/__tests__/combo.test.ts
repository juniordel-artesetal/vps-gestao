// Pacote SOA + Método Mãe numa cobrança única (16/10/2026): R$ 89,80/mês ou R$ 753/ano; quem já paga o SOA fica no MAE à parte.
import { describe, it, expect } from 'vitest'
import { precoCombo, cobrancaCombo, jaPagaSoa, nomeDoItemCombo, descricaoDoItemCombo } from '@/lib/mae/assinatura/combo'
import { precosMae } from '@/lib/mae/assinatura/precos'

const p = precosMae({ MAE_ADDON_MENSAL: '39.90', MAE_ADDON_ANUAL: '383', MAE_STANDALONE_MENSAL: '59.90', MAE_STANDALONE_ANUAL: '503' })!
const HOJE = new Date('2026-10-17T12:00:00-03:00')
describe('pacote SOA + MAE', () => {
  it('uma cobrança: SOA R$ 49,90 + MAE R$ 39,90 = R$ 89,80/mês; anual SOA R$ 370 + MAE R$ 383 = R$ 753', () => {
    expect(precoCombo(p, HOJE)).toEqual({ mensal: 89.8, anual: 753 })
    expect(cobrancaCombo(p, 'mensal', 1, HOJE).total).toBe(89.8)
    expect(cobrancaCombo(p, 'anual', 1, HOJE).total).toBe(753)
    const doze = cobrancaCombo(p, 'anual', 12, HOJE); expect(doze.parcelas).toBe(12); expect(doze.total).toBeGreaterThan(753)
  })
  it('quem já PAGA o SOA (ativa ou liberação manual) compra só o MAE à parte; teste, cortada, cancelada, aguardando → pacote', () => {
    expect(jaPagaSoa({ assinaturaStatus: 'ATIVA', liberacaoManual: false })).toBe(true)
    expect(jaPagaSoa({ assinaturaStatus: 'TRIAL', liberacaoManual: true })).toBe(true)
    for (const s of ['TRIAL', 'CORTADA', 'CANCELADA', 'AGUARDANDO_PAGAMENTO', 'INADIMPLENTE', 'MAE_STANDALONE', null]) expect(jaPagaSoa({ assinaturaStatus: s, liberacaoManual: false })).toBe(false)
  })
  it('no Asaas: um item só, "SOA + Método Mãe" (≤ 30) e a descrição diz "numa cobrança só"', () => {
    expect(nomeDoItemCombo('mensal')).toBe('SOA + Método Mãe · mensal'); expect(nomeDoItemCombo('anual').length).toBeLessThanOrEqual(30)
    expect(descricaoDoItemCombo('mensal', cobrancaCombo(p, 'mensal', 1, HOJE))).toMatch(/89,90|89,80/)
    expect(descricaoDoItemCombo('mensal', cobrancaCombo(p, 'mensal', 1, HOJE))).toMatch(/numa cobrança só/)
  })
})
