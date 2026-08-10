import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { trocarCodePorTokens } from '@/lib/logistica/melhorenvio'
import { verificarState } from '../_state'

export const dynamic = 'force-dynamic'

// GET — callback do Melhor Envio: valida state, troca code por tokens (criptografados),
// e volta pra tela de config. Não expõe token nenhum.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const origin = new URL(req.url).origin

  function voltar(status: 'ok' | 'erro' | 'negado') {
    return NextResponse.redirect(`${origin}/config/logistica?conexao=${status}`)
  }

  if (searchParams.get('error')) return voltar('negado')
  if (!code || !state) return voltar('erro')

  const workspaceIdState = verificarState(state)
  if (!workspaceIdState) return voltar('erro')

  // Dupla checagem: a sessão atual precisa bater com o workspace do state.
  const session = await getServerSession(authOptions)
  if (!session || session.user.workspaceId !== workspaceIdState) return voltar('erro')

  const ok = await trocarCodePorTokens(workspaceIdState, code)
  return voltar(ok ? 'ok' : 'erro')
}
