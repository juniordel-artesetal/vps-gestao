// E-mail da live de lançamento (16/10/2026 19h58): janela, link e conteúdo.
import { describe, it, expect } from 'vitest'
import { janelaEmailLive, montarEmailLive, LINK_LIVE_MAE } from '@/lib/mae/assinatura/emailLive'

describe('e-mail da live', () => {
  it('só sai em 16/10/2026 entre 19h50 e 21h (o cron anual não repete em 2027)', () => {
    expect(janelaEmailLive(new Date('2026-10-16T22:58:00Z'))).toBe(true)    // 19h58
    expect(janelaEmailLive(new Date('2026-10-16T22:40:00Z'))).toBe(false)   // 19h40
    expect(janelaEmailLive(new Date('2026-10-17T00:30:00Z'))).toBe(false)   // 21h30
    expect(janelaEmailLive(new Date('2027-10-16T22:58:00Z'))).toBe(false)
  })
  it('botão para a live no YouTube, nome e opt-out', () => {
    const r = montarEmailLive('Ana Paula', 'https://www.usesoa.com.br/api/reengajamento/optout?u=1&t=x')
    expect(r.assunto).toMatch(/live de lançamento do Método Mãe/)
    expect(r.html).toContain('Oi, Ana!'); expect(r.html).toContain(`href="${LINK_LIVE_MAE}"`); expect(r.html).toContain('20h')
    expect(LINK_LIVE_MAE).toBe('https://www.youtube.com/live/2wxv5XOCLNA?si=U7rjytMg0kvg3Tq0')
  })
})
