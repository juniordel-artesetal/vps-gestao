// Sessão do PORTAL DO PARCEIRO — separada do login da artesã (NextAuth) e do Master.
// Cookie "parceiro_sessao" = parceiroId assinado com HMAC (segredo do ambiente).
// Simples e stateless; expira em 7 dias. Nunca guarda senha no cookie.
import crypto from 'crypto'
import { cookies } from 'next/headers'

const COOKIE = 'parceiro_sessao'
const DIAS = 7

function segredo(): string {
  return process.env.PARCEIRO_SESSION_SECRET || process.env.NEXTAUTH_SECRET || process.env.MASTER_SECRET_TOKEN || 'dev-fallback'
}

export function assinarSessao(parceiroId: string): string {
  const payload = `${parceiroId}.${Date.now()}`
  const sig = crypto.createHmac('sha256', segredo()).update(payload).digest('base64url')
  return Buffer.from(`${payload}.${sig}`).toString('base64url')
}

function verificar(token: string | undefined | null): string | null {
  if (!token) return null
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8')
    const idx = raw.lastIndexOf('.')
    const payload = raw.slice(0, idx)
    const sig = raw.slice(idx + 1)
    const esperado = crypto.createHmac('sha256', segredo()).update(payload).digest('base64url')
    if (sig !== esperado) return null
    const [parceiroId, ts] = payload.split('.')
    if (!parceiroId || !ts) return null
    if (Date.now() - Number(ts) > DIAS * 24 * 60 * 60 * 1000) return null
    return parceiroId
  } catch { return null }
}

// Lê o parceiroId da sessão (server). null = não logado.
export async function getParceiroSessao(): Promise<string | null> {
  const c = await cookies()
  return verificar(c.get(COOKIE)?.value)
}

export async function setParceiroSessao(parceiroId: string) {
  const c = await cookies()
  c.set(COOKIE, assinarSessao(parceiroId), {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: DIAS * 24 * 60 * 60,
    secure: process.env.NODE_ENV === 'production',
  })
}

export async function limparParceiroSessao() {
  const c = await cookies()
  c.delete(COOKIE)
}
