// lib/telegramNotify.ts
// Envia notificações de eventos do VPS Stars (depoimentos, indicações)
// Mesmo padrão do feedback (HTML + log de erro explícito)

async function enviarTelegram(texto: string, contexto: string) {
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const CHAT  = process.env.TELEGRAM_CHAT_ID
  if (!TOKEN || !CHAT) {
    console.warn(`[TELEGRAM ${contexto}] Variáveis não configuradas`, { hasToken: !!TOKEN, hasChat: !!CHAT })
    return
  }

  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:    CHAT,
        text:       texto,
        parse_mode: 'HTML',
      }),
    })
    if (!r.ok) {
      const body = await r.text()
      console.error(`[TELEGRAM ${contexto}] Falha ${r.status}:`, body)
    } else {
      console.log(`[TELEGRAM ${contexto}] OK`)
    }
  } catch (err) {
    console.error(`[TELEGRAM ${contexto}]`, err)
  }
}

function agora() {
  return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ─── Depoimento novo ─────────────────────────────────────────────────────
export async function notificarDepoimento(p: {
  workspaceNome: string
  tipo: 'TEXTO' | 'VIDEO'
  conteudo: string
}) {
  const pontos = p.tipo === 'VIDEO' ? '+500 pts' : '+100 pts'
  const emoji  = p.tipo === 'VIDEO' ? '🎥' : '💬'
  const preview = p.conteudo.length > 300 ? p.conteudo.slice(0, 300) + '...' : p.conteudo

  const texto = [
    `${emoji} <b>Novo Depoimento — VPS Stars</b>`,
    ``,
    `<b>Ateliê:</b> ${esc(p.workspaceNome)}`,
    `<b>Tipo:</b> ${p.tipo === 'VIDEO' ? 'Vídeo' : 'Texto'} (${pontos} se aprovado)`,
    `<b>Horário:</b> ${agora()}`,
    ``,
    `<b>Conteúdo:</b>`,
    esc(preview),
    ``,
    `<i>Aprovar em /master → VPS Stars → Validações</i>`,
  ].join('\n')

  await enviarTelegram(texto, 'depoimento')
}

// ─── Indicação nova ──────────────────────────────────────────────────────
export async function notificarIndicacao(p: {
  workspaceNome: string
  nomeIndicada: string
  contatoIndicada: string
}) {
  const texto = [
    `👥 <b>Nova Indicação — VPS Stars</b>`,
    ``,
    `<b>Indicado por:</b> ${esc(p.workspaceNome)}`,
    `<b>Nome:</b> ${esc(p.nomeIndicada)}`,
    `<b>Contato:</b> ${esc(p.contatoIndicada)}`,
    `<b>Horário:</b> ${agora()}`,
    ``,
    `<i>+500 pts ao converter. Aprovar em /master → VPS Stars → Validações</i>`,
  ].join('\n')

  await enviarTelegram(texto, 'indicacao')
}
