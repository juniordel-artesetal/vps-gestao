// lib/alert.ts
// Envia alertas de erro para o Telegram do master
// Usar nos blocos catch das rotas críticas

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID

export async function alertarErro(opts: {
  rota: string
  erro: unknown
  workspaceId?: string
  detalhe?: string
}) {
  // Não bloqueia a response — fire and forget
  if (!BOT_TOKEN || !CHAT_ID) return

  try {
    const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const msg = erro instanceof Error ? erro.message : String(erro)
    const stack = erro instanceof Error && erro.stack
      ? '\n```\n' + erro.stack.split('\n').slice(0, 4).join('\n') + '\n```'
      : ''

    const texto = [
      `🚨 *Erro em produção — VPS Gestão*`,
      ``,
      `📍 *Rota:* \`${opts.rota}\``,
      opts.workspaceId ? `🏪 *Workspace:* \`${opts.workspaceId}\`` : null,
      opts.detalhe ? `📝 *Detalhe:* ${opts.detalhe}` : null,
      ``,
      `❌ *Erro:* ${msg}`,
      stack,
      ``,
      `🕐 ${agora}`,
    ].filter(l => l !== null).join('\n')

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: texto,
        parse_mode: 'Markdown',
      }),
    })
  } catch {
    // Silencioso — nunca deixar o alerta quebrar a rota
  }
}
