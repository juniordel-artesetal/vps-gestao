// Identificação da artesã no /migrar SEM exigir login. Ordem (primeira que existir):
//   1) TOKEN assinado no link do e-mail (?e=&t=) — reusa a HMAC do opt-out/migrar
//   2) SESSÃO logada (quando vem do pop-up dentro do sistema)
//   3) FALLBACK: e-mail informado na tela (validado por formato) — sem login
//
// O workspace é SEMPRE o EXISTENTE, casado pelo e-mail (User). Nunca cria conta.
import { prisma } from '@/lib/prisma'
import { tokenMigrarValido } from './emails'

export type ViaIdentidade = 'token' | 'sessao' | 'email'

const FORMATO_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Resolve o e-mail da artesã pela primeira fonte disponível, ou null se nenhuma. */
export function resolverEmailMigrar(o: {
  token?: string | null
  emailDoLink?: string | null
  sessionEmail?: string | null
  emailInformado?: string | null
}): { email: string; via: ViaIdentidade } | null {
  // 1) token assinado (autentica o e-mail do link)
  const eLink = (o.emailDoLink || '').trim().toLowerCase()
  if (eLink && o.token && tokenMigrarValido(eLink, o.token)) return { email: eLink, via: 'token' }
  // 2) sessão
  const eSes = (o.sessionEmail || '').trim().toLowerCase()
  if (eSes) return { email: eSes, via: 'sessao' }
  // 3) fallback: e-mail digitado (sem login), só com formato válido
  const eInf = (o.emailInformado || '').trim().toLowerCase()
  if (eInf && FORMATO_EMAIL.test(eInf)) return { email: eInf, via: 'email' }
  return null
}

/** Workspace EXISTENTE do e-mail (prefere a usuária ADMIN). Nunca cria nada. */
export async function workspacePorEmail(
  email: string,
): Promise<{ workspaceId: string; nome: string; trialAte: Date | null } | null> {
  const [w] = await prisma.$queryRaw`
    SELECT u."workspaceId", w."nome", w."trialAte"
    FROM "User" u
    JOIN "Workspace" w ON w."id" = u."workspaceId"
    WHERE lower(u."email") = ${email.toLowerCase()}
    ORDER BY (u."role" = 'ADMIN') DESC, u."createdAt" ASC
    LIMIT 1
  ` as { workspaceId: string; nome: string; trialAte: Date | null }[]
  return w ?? null
}
