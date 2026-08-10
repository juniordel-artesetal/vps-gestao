// State do OAuth: workspaceId assinado com HMAC (anti-CSRF/adulteração).
// Não-rota (prefixo _). Usa LOGISTICA_TOKEN_KEY (fallback CPF_ENCRYPTION_KEY).
import crypto from 'crypto'

function segredo(): string {
  return process.env.LOGISTICA_TOKEN_KEY || process.env.CPF_ENCRYPTION_KEY || 'dev-fallback'
}

export function assinarState(workspaceId: string): string {
  const payload = `${workspaceId}.${Date.now()}`
  const sig = crypto.createHmac('sha256', segredo()).update(payload).digest('base64url')
  return Buffer.from(`${payload}.${sig}`).toString('base64url')
}

// Retorna o workspaceId se a assinatura confere e não expirou (30 min).
export function verificarState(state: string): string | null {
  try {
    const raw = Buffer.from(state, 'base64url').toString('utf8')
    const idx = raw.lastIndexOf('.')
    const payload = raw.slice(0, idx)
    const sig = raw.slice(idx + 1)
    const esperado = crypto.createHmac('sha256', segredo()).update(payload).digest('base64url')
    if (sig !== esperado) return null
    const [workspaceId, ts] = payload.split('.')
    if (!workspaceId || !ts) return null
    if (Date.now() - Number(ts) > 30 * 60 * 1000) return null
    return workspaceId
  } catch { return null }
}
