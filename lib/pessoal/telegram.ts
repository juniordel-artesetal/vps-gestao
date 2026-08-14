// Telegram BYO-bot do PESSOAL: cada assinante cria o PRÓPRIO bot no BotFather e cola o token.
// O token é CRIPTOGRAFADO no banco (reusa o cripto do AsaasConfig) — nunca .env/chat.
// Roteamento por webhookId aleatório e não-adivinhável na URL do webhook.
import crypto from 'node:crypto'

export const TG_API = 'https://api.telegram.org'

async function tg<T = any>(token: string, metodo: string, corpo: unknown): Promise<{ ok: boolean; result?: T; erro?: string }> {
  try {
    const r = await fetch(`${TG_API}/bot${token}/${metodo}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo), signal: AbortSignal.timeout(15000),
    })
    const d = await r.json().catch(() => ({}))
    return r.ok && d.ok ? { ok: true, result: d.result } : { ok: false, erro: d.description || `HTTP ${r.status}` }
  } catch (e) { return { ok: false, erro: (e as Error)?.message } }
}

/** Valida o token (getMe) e devolve o @username do bot. */
export async function validarToken(token: string): Promise<{ ok: boolean; username?: string; erro?: string }> {
  const r = await tg<{ username?: string; is_bot?: boolean }>(token, 'getMe', {})
  if (!r.ok) return { ok: false, erro: r.erro }
  if (!r.result?.is_bot) return { ok: false, erro: 'Token não é de um bot.' }
  return { ok: true, username: r.result.username }
}

export function enviarMensagem(token: string, chatId: string | number, texto: string) {
  return tg(token, 'sendMessage', { chat_id: chatId, text: texto, parse_mode: 'HTML', disable_web_page_preview: true })
}

/** webhookId aleatório (32 hex) — roteia e é a fonte de imprevisibilidade da URL. */
export function webhookIdNovo(): string { return crypto.randomBytes(16).toString('hex') }

/** Secret token do webhook (camada extra): derivado do webhookId + token do bot. */
export function secretDoWebhook(webhookId: string, token: string): string {
  return crypto.createHash('sha256').update(webhookId + ':' + token).digest('hex').slice(0, 48)
}

/** Baixa uma foto do Telegram (getFile → file path → download) e devolve como data URL base64.
 *  Retorna null se falhar ou se o arquivo passar do limite. Escolha do tamanho fica a cargo de quem chama. */
export async function baixarFotoBase64(token: string, fileId: string, maxBytes = 2_000_000): Promise<string | null> {
  try {
    const info = await tg<{ file_path?: string; file_size?: number }>(token, 'getFile', { file_id: fileId })
    if (!info.ok || !info.result?.file_path) return null
    if ((info.result.file_size || 0) > maxBytes) return null
    const r = await fetch(`${TG_API}/file/bot${token}/${info.result.file_path}`, { signal: AbortSignal.timeout(20000) })
    if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length > maxBytes) return null
    const mime = r.headers.get('content-type') || 'image/jpeg'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch (e) { console.error('[PESSOAL-TG] baixarFoto', (e as Error)?.message); return null }
}

export function setWebhookBot(token: string, url: string, secret: string) {
  return tg(token, 'setWebhook', { url, secret_token: secret, allowed_updates: ['message'], drop_pending_updates: true })
}
export function deleteWebhookBot(token: string) { return tg(token, 'deleteWebhook', { drop_pending_updates: false }) }

// ── Parse de lançamento por linguagem natural (Gemini) ───────────────────────
const GEMINI_KEY = process.env.ANTHROPIC_API_KEY_GESTAO // (chave Google, nome legado)
export interface LancamentoIA { tipo: 'RECEITA' | 'DESPESA'; valor: number; descricao: string; categoria: string | null; conta: string | null; forma: string | null; data: string | null }

const SCHEMA_IA = {
  type: 'object',
  properties: {
    tipo: { type: 'string', enum: ['RECEITA', 'DESPESA'] },
    valor: { type: 'number' }, descricao: { type: 'string' },
    categoria: { type: 'string' }, conta: { type: 'string' }, forma: { type: 'string' },
    data: { type: 'string', description: 'YYYY-MM-DD ou vazio' },
  },
  required: ['tipo', 'valor', 'descricao'],
}

export async function parseLancamentoIA(texto: string, categorias: string[], contas: string[], hojeISO: string): Promise<LancamentoIA | null> {
  if (!GEMINI_KEY) return null
  const sys = `Você extrai UM lançamento financeiro pessoal de uma frase em português do Brasil.
Regra do TIPO pelo verbo: gastei/paguei/comprei/torrei = DESPESA; recebi/ganhei/entrou/caiu = RECEITA. Na dúvida, DESPESA.
valor = número em reais (aceite "20", "20,50", "1.200"). descricao = curta (o que foi).
categoria = escolha a MAIS próxima desta lista do usuário quando fizer sentido: [${categorias.join(', ') || 'nenhuma'}]; senão sugira uma curta.
conta = nome do banco/carteira se aparecer ("da conta nubank", "no nubank", "na carteira") — escolha a mais próxima de [${contas.join(', ') || 'nenhuma'}] ou devolva o nome dito; senão vazio.
forma = pix/cartão/dinheiro/boleto/ted (o MÉTODO de pagamento) se aparecer, senão vazio. NÃO confunda conta (banco) com forma (método).
data = ${hojeISO} se não disser; "ontem" = dia anterior; aceite datas explícitas → YYYY-MM-DD.
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
      conta: o.conta ? String(o.conta).trim() : null,
      forma: o.forma ? String(o.forma).trim() : null,
      data: /^\d{4}-\d{2}-\d{2}$/.test(o.data || '') ? o.data : null,
    }
  } catch (e) { console.error('[PESSOAL-TG] parse', (e as Error)?.message); return null }
}
