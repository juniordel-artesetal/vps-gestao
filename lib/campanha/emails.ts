// E-mails da campanha de migração (Hotmart→Asaas), voz da Equipe SOA. Transparente,
// simples, PASSO 2 em 1 clique. Opt-out no rodapé de todos. LGPD: só nome+e-mail.
//
// O LINK do Asaas com cupom vem de env (CAMPANHA_ASAAS_LINK) — enquanto não existir,
// a régua NÃO envia (trava da dependência do épico de pagamento).
import crypto from 'node:crypto'

const BASE = 'https://www.usesoa.com.br'
const esc = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const primeiroNome = (n: string | null) => (String(n || '').trim().split(/\s+/)[0] || 'amiga')

export function linkAsaas(): string {
  // Página INTERNA de migração (vincula ao workspace existente). Default = /migrar,
  // que já existe; CAMPANHA_ASAAS_LINK pode sobrescrever se preciso.
  return (process.env.CAMPANHA_ASAAS_LINK || '').trim() || `${BASE}/migrar`
}

export function tokenOptOut(email: string): string {
  return crypto.createHmac('sha256', process.env.NEXTAUTH_SECRET || 'campanha').update('campanha-optout:' + email.toLowerCase()).digest('hex').slice(0, 24)
}
export function tokenOptOutValido(email: string, t: string): boolean {
  const esp = tokenOptOut(email)
  try { return t.length === esp.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(esp)) } catch { return false }
}

// Token assinado do /migrar: identifica a artesã pelo LINK do e-mail, sem exigir
// login (mesma infra HMAC do opt-out, com propósito distinto no digest). O /migrar
// valida ${t} contra ${e} e resolve workspace+whitelist a partir do e-mail.
export function tokenMigrar(email: string): string {
  return crypto.createHmac('sha256', process.env.NEXTAUTH_SECRET || 'campanha').update('campanha-migrar:' + email.toLowerCase()).digest('hex').slice(0, 24)
}
export function tokenMigrarValido(email: string, t: string): boolean {
  const esp = tokenMigrar(email)
  try { return !!t && t.length === esp.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(esp)) } catch { return false }
}
/** Link do CTA por destinatária: /migrar?e=<email>&t=<hmac> — 1 clique, sem login. */
export function linkMigrar(email: string): string {
  const base = linkAsaas()
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}e=${encodeURIComponent(email)}&t=${tokenMigrar(email)}`
}

export type TipoEmailCampanha = 'fluxo' | 'falta_assinar' | 'falta_cancelar' | 'migrada'

// Caminho OFICIAL (help.hotmart.com/en/article/115002183968).
export const CANCELAR_HOTMART = 'Acesse <b>consumer.hotmart.com</b> → selecione o produto <b>SOA</b> → <b>Configurar pagamento</b> → <b>Cancelar assinatura</b> → confirmar.'
// Enquadramento (para reuso): cancelar na Hotmart NÃO reembolsa; o crédito vem no 1º mês.

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

// Copy FINAL (verbatim, voz Equipe SOA). Reforço em TODOS: a conta é a MESMA, nada
// se perde. CTA = "Migrar meu plano" → /migrar (página interna que vincula ao
// workspace existente). {{primeiro_nome}} preenchido.
export function montarEmailCampanha(
  tipo: TipoEmailCampanha,
  p: { email: string; primeiroNome: string | null; envio: number },
): { assunto: string; html: string } {
  const nome = esc(primeiroNome(p.primeiroNome))
  // CTA carrega o TOKEN da destinatária → /migrar identifica sem login e já mostra 9,90.
  const cta = botao('Migrar meu plano', linkMigrar(p.email))
  const cancelar = `Acesse <b>consumer.hotmart.com</b> → selecione o produto <b>SOA</b> → <b>Configurar pagamento</b> → <b>Cancelar assinatura</b> → confirmar.`

  if (tipo === 'migrada') {
    return {
      assunto: `Tudo certo, ${primeiroNome(p.primeiroNome)}! Sua mensalidade está no valor certo 💚`,
      html: envelope(`<p>Oi, ${nome}! 🧡</p>
        <p>Prontinho — está <b>tudo regularizado!</b> 🎉 Sua mensalidade agora é <b>R$ 29,90</b> (com o 1º mês por R$ 9,90, como combinamos), e sua conta segue exatamente como sempre, com todo o seu ateliê no lugar.</p>
        <p>Obrigada demais pela paciência e por continuar com a gente — significa muito. 💜 Se precisar de qualquer coisa, é só chamar. Bora vender muito!</p>`, p.email),
    }
  }

  if (tipo === 'falta_cancelar') { // assinou no SOA, falta cancelar a Hotmart
    return {
      assunto: `${primeiroNome(p.primeiroNome)}, falta só cancelar a Hotmart pra você não pagar dobrado ⚠️💛`,
      html: envelope(`<p>Oi, ${nome}! 🧡</p>
        <p>Que alegria, sua mensalidade no SOA já está ativa! 🎉 Falta só <b>um detalhe importante</b> pra você não ser cobrada duas vezes: <b>cancelar a cobrança antiga na Hotmart.</b></p>
        <p>É rapidinho:<br>${cancelar}</p>
        <p>Feito isso, está tudo certinho e no valor certo. Qualquer dúvida, é só responder. 💜</p>`, p.email),
    }
  }

  if (tipo === 'falta_assinar') { // cancelou a Hotmart, falta ativar no SOA
    return {
      assunto: `${primeiroNome(p.primeiroNome)}, falta só ativar pra garantir seu acesso 💛`,
      html: envelope(`<p>Oi, ${nome}! 🧡</p>
        <p>Vi que você já cancelou a cobrança antiga na Hotmart — perfeito! Agora falta <b>ativar sua mensalidade aqui no SOA</b> pra garantir que seu acesso continue certinho, no valor certo (<b>1º mês R$ 9,90</b>, depois R$ 29,90).</p>
        ${cta}
        <p style="margin-top:12px">É a mesma conta de sempre, nada se perde. Qualquer dúvida, tô aqui. 💜</p>`, p.email),
    }
  }

  // fluxo: 1º e-mail (dia 1) + lembretes A/B/C por envio
  const fluxo = [
    { // E-MAIL 1 — Dia 1
      assunto: `${primeiroNome(p.primeiroNome)}, vamos corrigir sua cobrança — 1º mês por só R$9,90 💛`,
      corpo: `<p>Oi, ${nome}! 🧡</p>
        <p>Passando pra resolver uma coisa rapidinho e do jeito certo. Sua assinatura do SOA foi cobrada <b>R$ 49,90</b> por uma regra antiga da Hotmart — mas o valor certo é <b>R$ 29,90, pra sempre.</b></p>
        <p>Pra deixar tudo em ordem, a gente preparou um caminho novo pela nossa própria cobrança, mais simples e no valor certo. E o melhor: <b>no 1º mês você paga só R$ 9,90</b> (já aplicamos o crédito da diferença); depois segue R$ 29,90/mês.</p>
        <p><b>Fica tranquila:</b> é a <b>mesma conta de sempre</b> — todos os seus pedidos, produtos, financeiro e configurações continuam exatamente como estão. Muda só a forma de cobrança. 💜</p>
        <p><b>São 2 passinhos:</b></p>
        <p><b>1) Cancelar a cobrança antiga na Hotmart:</b><br>${cancelar}<br><span style="font-size:13px;color:#6b7280">(Isso só impede cobranças futuras; seu acesso continua liberado.)</span></p>
        <p><b>2) Ativar sua mensalidade no SOA:</b></p>
        ${cta}
        <p style="margin-top:8px">Escolha o <b>cartão</b> (fica automático, você não pensa mais nisso) e pronto — 1º mês R$ 9,90.</p>
        <p>Qualquer dúvida, é só responder este e-mail que eu te ajudo passo a passo. 🥰</p>`,
    },
    { // E-MAIL 2 — variação A
      assunto: `${primeiroNome(p.primeiroNome)}, faltou só um passinho 💛`,
      corpo: `<p>Oi, ${nome}! 🧡</p>
        <p>Passando pra lembrar: pra sua mensalidade voltar ao valor certo (<b>R$ 29,90</b>, e o 1º mês por <b>R$ 9,90</b>), falta você fazer a troca — leva 1 minutinho e <b>sua conta continua a mesma</b>, com tudo que você já cadastrou.</p>
        ${cta}
        <p style="margin-top:12px">Se preferir, respondo aqui e te guio. 💜</p>`,
    },
    { // E-MAIL 3 — variação B
      assunto: `${primeiroNome(p.primeiroNome)}, seu 1º mês por R$9,90 continua te esperando ✨`,
      corpo: `<p>Oi, ${nome}! 🧡</p>
        <p>Seu lugar no SOA está guardado — e a condição especial também: <b>1º mês R$ 9,90</b>, depois R$ 29,90/mês, no cartão (automático) ou Pix.</p>
        <p>É só cancelar a cobrança antiga na Hotmart (consumer.hotmart.com → SOA → Configurar pagamento → Cancelar assinatura) e ativar aqui:</p>
        ${cta}
        <p style="margin-top:12px">Nada do seu ateliê se perde — mesma conta, mesmos dados. 💜</p>`,
    },
    { // E-MAIL 4 — variação C
      assunto: `${primeiroNome(p.primeiroNome)}, ainda dá tempo de ajustar sua mensalidade 💛`,
      corpo: `<p>Oi, ${nome}! 🧡</p>
        <p>Só passando de novo com todo o carinho: pra sua cobrança ficar no valor certo (R$ 29,90, 1º mês R$ 9,90), é só fazer a troca aqui — rapidinho e sem perder nada da sua conta.</p>
        ${cta}
        <p style="margin-top:12px">Se tiver qualquer dificuldade, me chama que eu faço junto com você. 💜</p>`,
    },
  ]
  const e = fluxo[Math.min(p.envio, fluxo.length - 1)]
  return { assunto: e.assunto, html: envelope(e.corpo, p.email) }
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
