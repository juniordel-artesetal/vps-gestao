// Identifica a assinante para a tela de reativação/assinatura SEM exigir login.
//
// Ordem: 1) SESSÃO (uso normal, dentro do sistema); 2) TOKEN assinado no link
// (?e=&t=) — a MESMA HMAC do /migrar (lib/campanha/emails). Serve para o Master
// gerar um link de reativação PRÉ-VINCULADO ao workspace da artesã, que abre a
// tela de planos (Mensal/Anual + 12x) já identificada, sem ela entrar na conta.
//
// O workspace é SEMPRE o EXISTENTE (casado pelo e-mail do token) — nunca cria conta.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { tokenMigrarValido } from '@/lib/campanha/emails'
import { workspacePorEmail } from '@/lib/campanha/identidade'

export interface Assinante {
  workspaceId: string
  email: string
  nomePessoa: string
  workspaceNome: string
  trialAte: Date | null
  via: 'sessao' | 'token'
}

/** Resolve a assinante pela sessão ou pelo token assinado (?e=&t=). null se nenhum. */
export async function identificarAssinante(o: {
  email?: string | null
  token?: string | null
}): Promise<Assinante | null> {
  const session = await getServerSession(authOptions)
  if (session?.user?.workspaceId) {
    return {
      workspaceId: session.user.workspaceId,
      email: session.user.email ?? '',
      nomePessoa: session.user.name ?? '',
      workspaceNome: session.user.workspaceNome ?? '',
      trialAte: null,
      via: 'sessao',
    }
  }

  const email = (o.email || '').trim().toLowerCase()
  if (email && o.token && tokenMigrarValido(email, o.token)) {
    const ws = await workspacePorEmail(email)
    if (ws) {
      return {
        workspaceId: ws.workspaceId,
        email,
        nomePessoa: ws.nome,
        workspaceNome: ws.nome,
        trialAte: ws.trialAte,
        via: 'token',
      }
    }
  }
  return null
}
