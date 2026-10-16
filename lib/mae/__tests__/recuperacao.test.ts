// Recuperação de vendas do Método Mãe (16/10/2026): qual e-mail sai e quando, e o que cada um diz/linka.
import { describe, it, expect } from 'vitest'
import { etapaDaVez, montarEmailRecuperacao, linkRetomar } from '@/lib/mae/assinatura/recuperacao'
import { precosMae } from '@/lib/mae/assinatura/precos'

const p = precosMae({ MAE_ADDON_MENSAL: '39.90', MAE_ADDON_ANUAL: '383', MAE_STANDALONE_MENSAL: '59.90', MAE_STANDALONE_ANUAL: '503' })!
const limpa = (h: string) => h.replace(/\u00a0/g, ' ')

describe('quando sai cada e-mail', () => {
  it('1 h, 24 h e 72 h; nada antes de 1 h nem depois de 7 dias', () => {
    expect(etapaDaVez(0.5, new Set())).toBeNull()
    expect(etapaDaVez(1.2, new Set())).toBe(1)
    expect(etapaDaVez(5, new Set([1]))).toBeNull()
    expect(etapaDaVez(25, new Set([1]))).toBe(2)
    expect(etapaDaVez(73, new Set([1, 2]))).toBe(3)
    expect(etapaDaVez(80, new Set([1, 2, 3]))).toBeNull()
    expect(etapaDaVez(24 * 8, new Set())).toBeNull()
  })
  it('cron atrasado: manda só a etapa mais nova (nunca duas de uma vez); as antigas não saem depois', () => {
    expect(etapaDaVez(30, new Set())).toBe(2)
    expect(etapaDaVez(31, new Set([2]))).toBeNull()
    expect(etapaDaVez(75, new Set([2]))).toBe(3)
  })
})

describe('o que cada e-mail diz', () => {
  it('o plano escolhido, o link que reabre o pagamento no mesmo plano e o cancelar avisos', () => {
    const d = { nome: 'Ana Paula', plano: 'addon' as const, ciclo: 'anual' as const, parcelas: 12 }
    const e1 = montarEmailRecuperacao(1, d, p, 'https://www.usesoa.com.br/api/reengajamento/optout?u=1&t=x')
    const h = limpa(e1.html)
    expect(e1.assunto).toMatch(/Faltou só um passo/)
    expect(h).toContain('Oi, Ana!')
    expect(h).toContain('12× de R$ 38,21')
    expect(h).toContain('soma à sua assinatura do SOA')
    expect(h).toContain(linkRetomar(d))
    expect(linkRetomar(d)).toBe('https://www.usesoa.com.br/mae/assinatura?ciclo=anual&parcelas=12')
    expect(h).toContain('escolha <b>12×</b>')
    expect(h).toContain('Cancelar os avisos')
    expect([...h.matchAll(/href="([^"]+)"/g)].every(m => m[1].startsWith('https://www.usesoa.com.br/'))).toBe(true)
  })
  it('conta só-MAE que nunca escolheu plano: mostra os preços do só-MAE; etapas 2 e 3 com a mensagem certa', () => {
    const d = { nome: null, plano: 'standalone' as const, ciclo: null, parcelas: 1 }
    const h = limpa(montarEmailRecuperacao(2, d, p, 'https://www.usesoa.com.br/x').html)
    expect(h).toContain('R$ 59,90/mês'); expect(h).toContain('R$ 503,00 por 1 ano'); expect(h).toContain('expira em 24 horas')
    expect(montarEmailRecuperacao(3, d, p, 'https://www.usesoa.com.br/x').assunto).toMatch(/Último lembrete/)
    expect(linkRetomar(d)).toBe('https://www.usesoa.com.br/mae/assinatura')
  })
})
