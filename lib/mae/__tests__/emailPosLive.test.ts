// Lembrete pós-live da oferta do Método Mãe (16/10/2026): preço do add-on, botões direto ao pagamento, link da live.
import { describe, it, expect } from 'vitest'
import { montarEmailPosLive, ehEnderecoDeTeste } from '@/lib/mae/assinatura/emailPosLive'
import { precosMae } from '@/lib/mae/assinatura/precos'

describe('lembrete pós-live', () => {
  const p = precosMae({ MAE_ADDON_MENSAL: '39.90', MAE_ADDON_ANUAL: '383', MAE_STANDALONE_MENSAL: '59.90', MAE_STANDALONE_ANUAL: '503' })!
  it('assinante do SOA: MAE R$ 39,90/mês, R$ 383 à vista, 12× — botões direto ao pagamento (conta=1); sem "grátis"', () => {
    const r = montarEmailPosLive('Maria Silva', p, 'https://www.usesoa.com.br/api/reengajamento/optout?u=1&t=x'), h = r.html.replace(/\u00a0/g, ' ')
    expect(r.assunto).toMatch(/R\$ 39,90\/mês/)
    expect(h).toContain('Oi, Maria!'); expect(h).toContain('Mensal — R$ 39,90/mês'); expect(h).toContain('Anual — R$ 383,00 à vista'); expect(h).toContain('12× de R$ 38,21')
    expect(h).toContain('/mae/pagar?o=soa-mae&ciclo=mensal&parcelas=1&conta=1'); expect(h).toContain('youtube.com/live/')
    expect(h).not.toContain('grátis'); expect(h).not.toContain('R$ 59,90')
  })
  it('endereço de teste fica de fora (derrubava o lote no Resend)', () => {
    expect(['a@example.com', 'b@x.test', 'c@gmail.com'].map(ehEnderecoDeTeste)).toEqual([true, true, false])
  })
})
