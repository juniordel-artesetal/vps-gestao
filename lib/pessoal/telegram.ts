// Bot dedicado do módulo PESSOAL. Vínculo por código + lançamento por linguagem natural.
// Segredos só no .env: TELEGRAM_PESSOAL_BOT_TOKEN (BotFather) e o username público
// NEXT_PUBLIC_TELEGRAM_PESSOAL_BOT_USERNAME. Gemini via ANTHROPIC_API_KEY_GESTAO (chave Google).
import crypto from 'node:crypto'

export const TG_API = 'https://api.telegram.org'
export function botToken(): string | null { return (process.env.TELEGRAM_PESSOAL_BOT_TOKEN || '').trim() || null }
export function botConfigurado(): boolean { return !!botToken() }

/** Secret do webhook (header x-telegram-bot-api-secret-token). Derivado do token — determinístico,
 *  sem env extra; muda junto se o token mudar. Fallback pra TELEGRAM_PESSOAL_WEBHOOK_SECRET se definido. */
export function webhookSecret(): string {
  const env = (process.env.TELEGRAM_PESSOAL_WEBHOOK_SECRET || '').trim()
  if (env) return env
  const t = botToken() || 'sem-token'
  return crypto.createHash('sha256').update('pessoal:' + t).digest('hex').slice(0, 48)
}

async function tg<T = any>(metodo: string, corpo: unknown): Promise<{ ok: boolean; result?: T; erro?: string }> {
  const tok = botToken()
  if (!tok) return { ok: false, erro: 'bot sem token' }
  try {
    const r = await fetch(`${TG_API}/bot${tok}/${metodo}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo), signal: AbortSignal.timeout(15000),
    })
    const d = await r.json().catch(() => ({}))
    return r.ok && d.ok ? { ok: true, result: d.result } : { ok: false, erro: d.description || `HTTP ${r.status}` }
  } catch (e) { return { ok: false, erro: (e as Error)?.message } }
}

export function enviarMensagem(chatId: string | number, texto: string) {
  return tg('sendMessage', { chat_id: chatId, text: texto, parse_mode: 'HTML', disable_web_page_preview: true })
}

/** Registra o webhook do bot (setWebhook) com o secret. baseUrl = origem pública (usesoa.com.br). */
export function registrarWebhook(baseUrl: string) {
  return tg('setWebhook', {
    url: `${baseUrl}/api/pessoal/telegram/webhook`,
    secret_token: webhookSecret(),
    allowed_updates: ['message'],
    drop_pending_updates: true,
  })
}
export function infoWebhook() { return tg('getWebhookInfo', {}) }

/** Código de vínculo curto (8 chars, sem ambíguos). */
export function gerarCodigo(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => abc[crypto.randomInt(abc.length)]).join('')
}

// ── Parse de lançamento por linguagem natural (Gemini) ───────────────────────
const GEMINI_KEY = process.env.ANTHROPIC_API_KEY_GESTAO // (chave Google, nome legado)
export interface LancamentoIA { tipo: 'RECEITA' | 'DESPESA'; valor: number; descricao: string; categoria: string | null; forma: string | null; data: string | null }

const SCHEMA_IA = {
  type: 'object',
  properties: {
    tipo: { type: 'string', enum: ['RECEITA', 'DESPESA'] },
    valor: { type: 'number' },
    descricao: { type: 'string' },
    categoria: { type: 'string' },
    forma: { type: 'string' },
    data: { type: 'string', description: 'YYYY-MM-DD ou vazio' },
  },
  required: ['tipo', 'valor', 'descricao'],
}

/** Interpreta "gastei 20 no mercado no pix" → objeto. null se não der pra extrair valor. */
export async function parseLancamentoIA(texto: string, categorias: string[], hojeISO: string): Promise<LancamentoIA | null> {
  if (!GEMINI_KEY) return null
  const sys = `Você extrai UM lançamento financeiro pessoal de uma frase em português do Brasil.
Regra do TIPO pelo verbo: gastei/paguei/comprei/torrei = DESPESA; recebi/ganhei/entrou/caiu = RECEITA. Na dúvida, DESPESA.
valor = número em reais (aceite "20", "20,50", "1.200"). descricao = curta (o que foi).
categoria = escolha a MAIS próxima desta lista do usuário quando fizer sentido: [${categorias.join(', ') || 'nenhuma'}]; senão sugira uma curta.
forma = pix/cartão/dinheiro/boleto/ted se aparecer, senão vazio. data = ${hojeISO} se não disser; "ontem" = dia anterior; aceite datas explícitas → YYYY-MM-DD.
Responda só o JSON.`
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sys }] },
        contents: [{ role: 'user', parts: [{ text: texto }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 300, responseMimeType: 'application/json', responseSchema: SCHEMA_IA, thinkingConfig: { thinkingBudget: 0 } },
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) { console.error('[PESSOAL-TG] Gemini', res.status); return null }
    const d = await res.json()
    const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!txt) return null
    const o = JSON.parse(txt)
    const valor = Math.round((Number(o.valor) || 0) * 100) / 100
    if (valor <= 0) return null
    return {
      tipo: o.tipo === 'RECEITA' ? 'RECEITA' : 'DESPESA',
      valor, descricao: String(o.descricao || '').trim().slice(0, 120) || 'Lançamento',
      categoria: o.categoria ? String(o.categoria).trim() : null,
      forma: o.forma ? String(o.forma).trim() : null,
      data: /^\d{4}-\d{2}-\d{2}$/.test(o.data || '') ? o.data : null,
    }
  } catch (e) { console.error('[PESSOAL-TG] parse', (e as Error)?.message); return null }
}
