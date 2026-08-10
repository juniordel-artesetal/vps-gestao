import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { authorizeUrl, credenciaisConfiguradas } from '@/lib/logistica'
import { assinarState } from '../_state'

export const dynamic = 'force-dynamic'

// GET — inicia o OAuth do Melhor Envio: redireciona pro authorize com state assinado.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  if (!credenciaisConfiguradas())
    return NextResponse.json({ error: 'Credenciais do Melhor Envio não configuradas no servidor' }, { status: 400 })

  const state = assinarState(session.user.workspaceId)
  return NextResponse.redirect(authorizeUrl(state))
}
