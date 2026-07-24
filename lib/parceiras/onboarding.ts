// Sessão de ONBOARDING da parceira.
//
// Ao enviar a candidatura leve, a parceira ainda não tem senha — então não dá
// para logar pelo caminho normal (Credentials). Emitimos aqui um JWT NextAuth
// próprio, com role='parceira' + parceiroId e SEM workspaceId, gravado no MESMO
// cookie de sessão que o getServerSession/middleware já leem. É por isso que ela
// cai direto na área dela para completar o cadastro.
//
// Segurança: o token é assinado com NEXTAUTH_SECRET (só o servidor emite), escopo
// estrito ao próprio parceiroId, sem workspaceId — o middleware do Ticket 03 já
// impede parceira de entrar em rota de artesã, e nenhum endpoint de artesã aceita
// role='parceira'. O caminho de auth das artesãs fica 100% intocado.
import { encode } from 'next-auth/jwt'

const MAX_AGE = 7 * 24 * 60 * 60 // 7 dias — tempo folgado para completar o cadastro

function usaCookieSeguro(): boolean {
  return (process.env.NEXTAUTH_URL || '').startsWith('https://')
}

/** Nome do cookie de sessão do NextAuth (varia com https). */
export function nomeCookieSessao(): string {
  return usaCookieSeguro() ? '__Secure-next-auth.session-token' : 'next-auth.session-token'
}

/** Monta o cookie de sessão de onboarding pronto para `res.cookies.set(...)`. */
export async function cookieSessaoOnboarding(p: { parceiroId: string; nome: string | null; email: string | null }) {
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET as string,
    maxAge: MAX_AGE,
    token: {
      sub: p.parceiroId,
      id: p.parceiroId,
      role: 'parceira',
      parceiroId: p.parceiroId,
      name: p.nome ?? undefined,
      email: p.email ?? undefined,
      workspaceId: null,
      onboarding: true,
    } as any,
  })
  return {
    name: nomeCookieSessao(),
    value: token,
    options: {
      httpOnly: true,
      sameSite: 'lax' as const,
      path: '/',
      secure: usaCookieSeguro(),
      maxAge: MAX_AGE,
    },
  }
}
