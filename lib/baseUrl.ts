// Base URL pública p/ links compartilháveis (orçamento, etc).
// Deriva do host da requisição — quem gera o link está no domínio atual (usesoa.com.br).
// Ignora localhost, previews *.vercel.app e o domínio antigo, caindo no canônico.
const CANONICO = 'https://www.usesoa.com.br'

export function baseUrlDeHeaders(h: { get(name: string): string | null }): string {
  const env = process.env.APP_PUBLIC_URL?.replace(/\/+$/, '')
  if (env) return env
  const host = (h.get('x-forwarded-host') || h.get('host') || '').toLowerCase().trim()
  const ehRuim =
    !host ||
    host.includes('localhost') ||
    host.startsWith('127.') ||
    host.endsWith('.vercel.app') ||
    host.includes('vps-gestao.com.br')
  if (ehRuim) return CANONICO
  const proto = (h.get('x-forwarded-proto') || 'https').split(',')[0].trim()
  return `${proto}://${host}`
}

export { CANONICO as BASE_URL_CANONICO }
