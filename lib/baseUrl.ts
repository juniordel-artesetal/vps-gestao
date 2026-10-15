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

/**
 * Endereço do SOA nos E-MAILS e mensagens (links "pagar", "entrar", "assinatura"…). Nunca o domínio antigo: o
 * NEXTAUTH_URL da produção ainda aponta para app.vps-gestao.com.br (é do login — não se troca por causa de link),
 * e e-mail com o domínio antigo confunde a cliente. APP_PUBLIC_URL manda, se não for o antigo.
 */
export const URL_SOA = (() => {
  const env = process.env.APP_PUBLIC_URL?.replace(/\/+$/, '')
  return env && !env.includes('vps-gestao.com.br') ? env : CANONICO
})()
