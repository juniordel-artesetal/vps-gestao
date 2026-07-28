// E-mails da campanha de migração (Hotmart→Asaas), voz da Equipe SOA. Transparente,
// simples, PASSO 2 em 1 clique. Opt-out no rodapé de todos. LGPD: só nome+e-mail.
//
// O LINK do Asaas com cupom vem de env (CAMPANHA_ASAAS_LINK) — enquanto não existir,
// a régua NÃO envia (trava da dependência do épico de pagamento).
import crypto from 'node:crypto'

const BASE = 'https://www.usesoa.com.br'
const esc = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const primeiroNome = (n: string | null) => (String(n || '').trim().split(/\s+/)[0] || 'amiga')

export function linkAsaas(): string | null {
  const l = (process.env.CAMPANHA_ASAAS_LINK || '').trim()
  return l || null
}

export function tokenOptOut(email: string): string {
  return crypto.createHmac('sha256', process.env.NEXTAUTH_SECRET || 'campanha').update('campanha-optout:' + email.toLowerCase()).digest('hex').slice(0, 24)
}
export function tokenOptOutValido(email: string, t: string): boolean {
  const esp = tokenOptOut(email)
  try { return t.length === esp.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(esp)) } catch { return false }
}

export type TipoEmailCampanha = 'fluxo' | 'falta_assinar' | 'falta_cancelar' | 'migrada'

const CANCELAR_HOTMART = 'Acesse <b>app.hotmart.com</b> → <b>Minhas assinaturas</b> → <b>SOA</b> → <b>Cancelar assinatura</b>.'

function envelope(corpo: string, email: string): string {
  const optout = `${BASE}/api/campanha/optout?e=${encodeURIComponent(email)}&t=${tokenOptOut(email)}`
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#1f2937;max-width:560px;margin:0 auto;padding:8px;line-height:1.5">
    ${corpo}
    <p style="margin:28px 0 0;font-size:12px;color:#9ca3af">Com carinho, Equipe SOA 💛<br>
    Não quer mais receber estes lembretes? <a href="${optout}" style="color:#9ca3af">Cancelar avisos</a>.</p>
  </div>`
}
function botao(texto: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:11px 20px;border-radius:10px;margin:6px 0">${esc(texto)}</a>`
}

/** Aberturas variadas pra os e-mails de lembrete não ficarem idênticos. */
const ABERTURAS = [
  (n: string) => `Oi, ${n}! 💛`,
  (n: string) => `Oi de novo, ${n}! Passando pra lembrar 💛`,
  (n: string) => `${n}, ainda dá tempo de corrigir sua cobrança 💛`,
  (n: string) => `Oi, ${n}! Só um lembrete rapidinho 💛`,
]

export function montarEmailCampanha(
  tipo: TipoEmailCampanha,
  p: { email: string; primeiroNome: string | null; envio: number },
): { assunto: string; html: string } {
  const nome = esc(primeiroNome(p.primeiroNome))
  const link = linkAsaas()
  const abertura = ABERTURAS[Math.min(p.envio, ABERTURAS.length - 1)](nome)

  if (tipo === 'migrada') {
    return {
      assunto: 'Prontinho! Sua migração está concluída 💛',
      html: envelope(`<p>Oi, ${nome}! 💛</p>
        <p>Sua migração para o novo plano do SOA (R$ 29,90/mês) está <b>concluída</b> — obrigada por resolver com a gente! 🧡</p>
        <p>Seu acesso segue liberado normalmente. Qualquer dúvida, é só responder este e-mail.</p>`, p.email),
    }
  }

  if (tipo === 'falta_cancelar') {
    return {
      assunto: 'Falta só 1 passo pra fechar sua migração 💛',
      html: envelope(`<p>${abertura}</p>
        <p>Vi que você já assinou o novo plano do SOA — <b>obrigada!</b> 🧡 Falta só um detalhe pra não pagar duas vezes:</p>
        <p><b>Cancele a assinatura antiga na Hotmart.</b><br>${CANCELAR_HOTMART}</p>
        <p>Feito isso, tá tudo certo. 💛</p>`, p.email),
    }
  }

  if (tipo === 'falta_assinar') {
    const corpo = `<p>${abertura}</p>
      <p>Vi que você já cancelou a assinatura antiga na Hotmart — <b>ótimo!</b> Falta só reativar pelo novo plano, com o crédito da diferença:</p>
      <p><b>Assine pelo link do SOA</b> — no 1º mês você paga só <b>R$ 9,90</b> (já aplicamos o crédito); depois segue R$ 29,90/mês.</p>
      ${link ? botao('Assinar por R$ 9,90 no 1º mês', link) : '<p style="color:#9ca3af">(link em breve)</p>'}`
    return { assunto: 'Falta só assinar o novo plano (1º mês R$ 9,90) 💛', html: envelope(corpo, p.email) }
  }

  // fluxo completo (1º e-mail e lembretes)
  const corpo = `<p>${abertura}</p>
    <p>A Hotmart cobrou <b>R$ 49,90</b> pela regra antiga — mas o valor certo do SOA é <b>R$ 29,90/mês</b>. Vamos corrigir isso juntas, em 2 passinhos:</p>
    <p><b>Passo 1 — Cancelar a assinatura atual na Hotmart</b><br>${CANCELAR_HOTMART}</p>
    <p><b>Passo 2 — Assinar de novo pelo link do SOA</b><br>No 1º mês você paga só <b>R$ 9,90</b> (já aplicamos o crédito da diferença); depois segue R$ 29,90/mês.</p>
    ${link ? botao('Assinar por R$ 9,90 no 1º mês', link) : '<p style="color:#9ca3af">(link de assinatura em breve)</p>'}
    <p style="margin-top:14px">Seu acesso continua liberado o tempo todo. Qualquer dúvida, é só responder este e-mail. 💛</p>`
  return { assunto: 'Vamos corrigir sua cobrança — 1º mês por só R$ 9,90 💛', html: envelope(corpo, p.email) }
}

export async function enviarEmailCampanha(para: string, assunto: string, html: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'SOA <suporte@vps-gestao.com.br>', to: [para], subject: assunto, html }),
    })
    if (!r.ok) throw new Error(`Resend ${r.status}`)
    return true
  } catch (e) { console.error('[CAMPANHA-EMAIL]', (e as Error)?.message); return false }
}
