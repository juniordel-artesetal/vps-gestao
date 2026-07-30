// Inicia o OAuth do Mercado Livre para a workspace logada → redireciona ao ML.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { credenciaisConfiguradas, assinarState, urlAutorizacao } from '@/lib/mercadolivre/conta'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  if (!credenciaisConfiguradas())
    return NextResponse.json({ error: 'Integração do Mercado Livre ainda não configurada.' }, { status: 503 })

  const state = assinarState(session.user.workspaceId)
  return NextResponse.redirect(urlAutorizacao(state))
}
