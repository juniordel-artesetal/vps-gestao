// Inicia o OAuth do TikTok Shop para a workspace logada → redireciona ao TikTok.
// O workspaceId viaja no STATE assinado (CSRF); é por aqui que a artesã deve começar.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { integracoesAtivo, credenciaisConfiguradas, assinarState, urlAutorizacao } from '@/lib/tiktok/conta'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!integracoesAtivo())
    return NextResponse.json({ error: 'Integração indisponível.' }, { status: 404 })
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  if (!credenciaisConfiguradas())
    return NextResponse.json({ error: 'Integração do TikTok ainda não configurada.' }, { status: 503 })

  const state = assinarState(session.user.workspaceId)
  return NextResponse.redirect(urlAutorizacao(state))
}
