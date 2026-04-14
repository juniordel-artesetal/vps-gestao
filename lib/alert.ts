// lib/alert.ts
// Envia alertas de erro crítico via Telegram para o canal de monitoramento
// Usado internamente pelas rotas para notificar falhas em produção

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID   = process.env.TELEGRAM_CHAT_ID

export async function alertarErro(contexto: string, erro: unknown) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return

  try {
    const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const msg   = erro instanceof Error ? erro.message : String(erro)
    const stack = erro instanceof Error && erro.stack
      ? '\n```\n' + erro.stack.split('\n').slice(0, 4).join('\n') + '\n```'
      : ''

    const texto = `🚨 *Erro VPS Gestão*\n\n*Contexto:* ${contexto}\n*Horário:* ${agora}\n*Erro:* ${msg}${stack}`

    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:    TELEGRAM_CHAT_ID,
        text:       texto,
        parse_mode: 'Markdown',
      }),
    })
  } catch {
    // silencioso — alerta não pode quebrar o fluxo principal
  }
}
