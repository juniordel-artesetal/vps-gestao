// E-mails da parceira — COPY FINAL do Diretor, tom SOA. VERBATIM: os textos abaixo
// são exatamente os aprovados; só os {placeholders} são preenchidos. Não reescrever.
//
// Envio pelo Resend. O corpo é texto puro renderizado em <pre> com quebra de linha
// preservada — assim o e-mail sai byte a byte igual à copy, sem risco de o HTML
// "melhorar" a redação. Nunca lança: e-mail é consequência, não pode derrubar o
// fluxo que o disparou.
const primeiroNome = (n: string | null | undefined) => (String(n || '').trim().split(/\s+/)[0] || 'parceira')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Empacota o texto verbatim num HTML mínimo (pre-wrap) e manda pelo Resend. */
export async function enviarEmailParceira(para: string, assunto: string, corpo: string): Promise<boolean> {
  if (!para || !process.env.RESEND_API_KEY) return false
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#1f2937;max-width:560px;margin:0 auto;padding:8px">
    <pre style="white-space:pre-wrap;word-break:break-word;font-family:inherit;font-size:15px;line-height:1.5;margin:0">${esc(corpo)}</pre>
  </div>`
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'SOA <suporte@vps-gestao.com.br>', to: [para], subject: assunto, html }),
    })
    if (!r.ok) throw new Error(`Resend ${r.status}`)
    return true
  } catch (e) {
    console.error(`[PARCEIRA-EMAIL] falha "${assunto}" → ${para}:`, (e as Error)?.message)
    return false
  }
}

// ── COPY VERBATIM (Diretor) ──────────────────────────────────────────────────

export function emailAprovacao(nome: string | null, cupom: string): { assunto: string; corpo: string } {
  return {
    assunto: '🎉 Bem-vinda ao Programa de Parceiras do SOA!',
    corpo: `Oi, ${primeiroNome(nome)}!

Sua candidatura foi aprovada — que alegria ter você com a gente. 💛

A partir de agora, cada seguidora que você indicar e que assinar o SOA gera comissão pra você, de forma automática.

Seu link exclusivo: usesoa.com.br/r/${cupom}
Seu cupom: ${cupom}

É só compartilhar o link (ou pedir pra digitarem seu cupom no cadastro). Quem chega por você ganha 7 dias grátis pra testar. 😉

Acompanhe tudo (cliques, cadastros e seus ganhos) no seu painel:
usesoa.com.br/parceira

Qualquer dúvida, é só responder este e-mail.

Com carinho,
Equipe SOA`,
  }
}

export function emailRecusa(nome: string | null): { assunto: string; corpo: string } {
  return {
    assunto: 'Sobre sua candidatura ao Programa de Parceiras do SOA',
    corpo: `Oi, ${primeiroNome(nome)},

Obrigada pelo seu interesse em ser parceira do SOA! Por enquanto não vamos seguir com a sua candidatura, mas isso pode mudar — fique à vontade pra tentar de novo mais pra frente.

Com carinho,
Equipe SOA`,
  }
}

export function emailResumoSemanal(
  nome: string | null,
  d: { cliques: number; cadastros: number; assinaturas: number; recebido: string; pendente: string },
): { assunto: string; corpo: string } {
  return {
    assunto: '📊 Seu resumo da semana no SOA',
    corpo: `Oi, ${primeiroNome(nome)}!

O que rolou com suas indicações nos últimos 7 dias:

👀 ${d.cliques} cliques no seu link
✍️ ${d.cadastros} novas indicadas cadastradas
🎉 ${d.assinaturas} assinaturas

💰 Total já recebido: ${d.recebido}
⏳ A receber: ${d.pendente}

Cada compartilhamento conta. Bora pra próxima semana! 💛

Ver detalhes no painel: usesoa.com.br/parceira

Com carinho,
Equipe SOA`,
  }
}

export function emailResumoSemanalSemNovidades(nome: string | null, cupom: string): { assunto: string; corpo: string } {
  return {
    assunto: '📊 Seu resumo da semana no SOA',
    corpo: `Oi, ${primeiroNome(nome)}!

Essa semana ainda não teve movimento nas suas indicações — e tá tudo bem, faz parte. 💛

Que tal compartilhar seu link de novo hoje? usesoa.com.br/r/${cupom}

Seu painel está aqui quando quiser: usesoa.com.br/parceira

Com carinho,
Equipe SOA`,
  }
}

export function emailSeguidoraTrial(nomeParceira: string | null, nomeIndicada: string | null, plano: string): { assunto: string; corpo: string } {
  return {
    assunto: '✨ Uma seguidora sua entrou no SOA pelo seu link!',
    corpo: `Oi, ${primeiroNome(nomeParceira)}!

${primeiroNome(nomeIndicada)} acabou de entrar no SOA pelo seu link e começou o teste do ${plano}. ✨

Assim que o teste dela virar assinatura paga, sua comissão aparece no seu painel. Acompanhe por lá:
usesoa.com.br/parceira

Continua compartilhando — está funcionando! 💪

Com carinho,
Equipe SOA`,
  }
}

// ── INFLUENCIADORA ─────────────────────────────────────────────────────────
// Boas-vindas quando o Master "Ativar influenciadora" (cortesia + parceria).
export function emailBoasVindasInfluenciadora(nome: string | null, cupom: string): { assunto: string; corpo: string } {
  return {
    assunto: '🎉 Bem-vinda ao Programa de Parceiras do SOA!',
    corpo: `Oi, ${primeiroNome(nome)}! Sua parceria está ativa 💛

• Seu SOA está liberado sem cobrança enquanto você for nossa parceira.
• Seu link pra indicar: usesoa.com.br/r/${cupom} — quem entrar por ele ganha 14 dias grátis.
• Seu painel de indicações: usesoa.com.br/parceira (lá você coloca sua conta Asaas pra receber direto).

Mostre o SOA do seu jeito, quando fizer sentido. Qualquer dúvida, é só responder este e-mail.

— Equipe SOA`,
  }
}

// Aviso gentil quando a cortesia é encerrada (14 dias de carência pra assinar).
export function emailCarenciaCortesia(nome: string | null): { assunto: string; corpo: string } {
  return {
    assunto: 'Sobre o seu acesso ao SOA 💛',
    corpo: `Oi, ${primeiroNome(nome)}!

Passando pra avisar com carinho: seu acesso de cortesia ao SOA vai até daqui a 14 dias. Depois desse período, é só assinar um dos planos pra continuar usando tudo normalmente — seus dados, pedidos e cálculos continuam guardadinhos, exatamente como você deixou.

E fica tranquila: sua parceria continua ativa. Você segue com seu link de indicação e ganhando comissão por quem você trouxer. 💪

Pra assinar quando quiser: é só entrar no SOA que a gente te mostra as opções.

Qualquer dúvida, responde este e-mail.

— Equipe SOA`,
  }
}
