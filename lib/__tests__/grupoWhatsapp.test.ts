// Grupo de suporte das assinantes do SOA no WhatsApp (16/10/2026): quem recebe (só assinante ativa do SOA) e o e-mail.
import { describe, it, expect } from 'vitest'
import { ehAssinanteAtivaSoa, montarEmailGrupo, linkGrupoWhatsapp, LINK_GRUPO_WHATSAPP } from '@/lib/avisos/grupoWhatsapp'

describe('público do grupo', () => {
  it('ativa (Asaas/Hotmart) ou liberação manual — nunca teste, atraso, cortada, cancelada, conta inativa ou só-MAE', () => {
    const w = (x: Partial<Parameters<typeof ehAssinanteAtivaSoa>[0]>) => ehAssinanteAtivaSoa({ ativo: true, assinaturaStatus: 'ATIVA', liberacaoManual: false, ...x })
    expect(w({})).toBe(true)
    expect(w({ assinaturaStatus: 'TRIAL', liberacaoManual: true })).toBe(true)
    for (const s of ['TRIAL', 'INADIMPLENTE', 'CORTADA', 'CANCELADA', 'AGUARDANDO_PAGAMENTO']) expect(w({ assinaturaStatus: s })).toBe(false)
    expect(w({ ativo: false })).toBe(false)
    expect(w({ soMae: true })).toBe(false)
  })
})

describe('o e-mail', () => {
  it('botão "Entrar no grupo" com o link do WhatsApp, nome da pessoa e opt-out', () => {
    const r = montarEmailGrupo('Maria <b>Silva</b>', 'https://www.usesoa.com.br/api/reengajamento/optout?u=1&t=x')
    expect(r.assunto).toMatch(/grupo de suporte/)
    expect(r.html).toContain('Oi, Maria!')
    expect(r.html).toContain(`href="${LINK_GRUPO_WHATSAPP}"`); expect(r.html).toContain('Entrar no grupo')
    expect(r.html).toContain('optout')
    expect(LINK_GRUPO_WHATSAPP).toBe('https://chat.whatsapp.com/LcOOS2ZCpqKIIU2jdgs65u')
  })
  it('o link pode ser trocado pela env (só se for um link de grupo do WhatsApp)', () => {
    expect(linkGrupoWhatsapp({ GRUPO_WHATSAPP_LINK: 'https://chat.whatsapp.com/Outro' })).toBe('https://chat.whatsapp.com/Outro')
    expect(linkGrupoWhatsapp({ GRUPO_WHATSAPP_LINK: 'https://site-estranho.com' })).toBe(LINK_GRUPO_WHATSAPP)
    expect(linkGrupoWhatsapp({})).toBe(LINK_GRUPO_WHATSAPP)
  })
})
