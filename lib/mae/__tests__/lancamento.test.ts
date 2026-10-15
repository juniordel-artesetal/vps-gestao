// Lançamento do Método Mãe (16/10/2026 20h): horário da venda, janela do pop-up e do e-mail, plano de quem está com o
// SOA inativo e o conteúdo do e-mail (as duas versões).
import { describe, it, expect } from 'vitest'
import { lancamentoMaeChegou, janelaPopupMae, janelaEmailLancamentoMae, inicioLancamentoMae } from '@/lib/mae/assinatura/lancamento'
import { precosMae } from '@/lib/mae/assinatura/precos'
import { planoPeloEstado } from '@/lib/mae/assinatura/servidor'
import { montarEmailLancamento } from '@/lib/mae/assinatura/emailLancamento'

const SEM: Record<string, string> = {}
const t = (iso: string) => new Date(iso)

describe('horário do lançamento (Brasília)', () => {
  it('abre às 20h de 16/10 — nem um segundo antes', () => {
    expect(lancamentoMaeChegou(t('2026-10-16T22:59:59Z'), SEM)).toBe(false)   // 19:59:59
    expect(lancamentoMaeChegou(t('2026-10-16T23:00:00Z'), SEM)).toBe(true)    // 20:00
    expect(inicioLancamentoMae({ MAE_LANCAMENTO_EM: 'lixo' }).toISOString()).toBe('2026-10-16T23:00:00.000Z')
  })
  it('pop-up: do lançamento até 26/10 23:59', () => {
    expect(janelaPopupMae(t('2026-10-16T22:00:00Z'), SEM)).toBe(false)
    expect(janelaPopupMae(t('2026-10-20T15:00:00Z'), SEM)).toBe(true)
    expect(janelaPopupMae(t('2026-10-27T02:59:00Z'), SEM)).toBe(true)          // 26/10 23:59
    expect(janelaPopupMae(t('2026-10-27T03:00:00Z'), SEM)).toBe(false)         // 27/10 00:00
  })
  it('e-mail: só de 16/10 20h até 17/10 — o agendamento anual não repete em 2027', () => {
    expect(janelaEmailLancamentoMae(t('2026-10-16T23:00:00Z'), SEM)).toBe(true)
    expect(janelaEmailLancamentoMae(t('2026-10-16T22:00:00Z'), SEM)).toBe(false)
    expect(janelaEmailLancamentoMae(t('2027-10-16T23:00:00Z'), SEM)).toBe(false)
  })
})

describe('quem compra o quê', () => {
  it('SOA ativo → SOA + Método Mãe (add-on); SOA inativo → só o Método Mãe; quem já comprou mantém o plano', () => {
    expect(planoPeloEstado(null, true)).toBe('addon')
    expect(planoPeloEstado(null, false)).toBe('standalone')
    expect(planoPeloEstado('addon', false)).toBe('addon')
    expect(planoPeloEstado('standalone', true)).toBe('standalone')
  })
})

describe('e-mail do lançamento', () => {
  const p = precosMae({ MAE_ADDON_MENSAL: '39.90', MAE_ADDON_ANUAL: '383', MAE_STANDALONE_MENSAL: '59.90', MAE_STANDALONE_ANUAL: '503' })!
  it('ativa: SOA + Método Mãe com o preço do add-on, 7 dias grátis, link só www.usesoa.com.br e cancelar avisos', () => {
    const r = montarEmailLancamento('ativa', 'Maria <b>Silva</b>', p, 'https://www.usesoa.com.br/api/reengajamento/optout?u=1&t=x'), assunto = r.assunto, html = r.html.replace(/\u00a0/g, ' ')
    expect(assunto).toMatch(/SOA \+ Método Mãe/)
    expect(html).toContain('Oi, Maria!')
    expect(html).toContain('+ R$ 39,90/mês')
    expect(html).toContain('R$ 383,00')
    expect(html).toContain('7 dias grátis')
    expect(html).not.toContain('R$ 59,90')
    expect(html).toContain('Cancelar os avisos')
    expect([...html.matchAll(/href="([^"]+)"/g)].every(m => m[1].startsWith('https://www.usesoa.com.br/'))).toBe(true)
  })
  it('inativa: pode assinar SÓ o Método Mãe (preço do só-MAE) ou voltar ao SOA completo', () => {
    const r = montarEmailLancamento('inativa', null, p, 'https://www.usesoa.com.br/x'), assunto = r.assunto, html = r.html.replace(/\u00a0/g, ' ')
    expect(assunto).toMatch(/só ele/)
    expect(html).toContain('Oi!')
    expect(html).toContain('R$ 59,90/mês')
    expect(html).toContain('R$ 503,00')
    expect(html).toContain('https://www.usesoa.com.br/assinatura')
    expect(html).toContain('assinar só o Método Mãe')
  })
})
