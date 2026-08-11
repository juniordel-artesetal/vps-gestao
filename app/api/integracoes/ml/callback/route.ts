// Callback do OAuth do Mercado Livre. O workspaceId vem no STATE assinado (não da sessão).
import { NextRequest, NextResponse } from 'next/server'
import { validarState, conectarComCode } from '@/lib/mercadolivre/conta'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const destino = (q: string) => NextResponse.redirect(new URL(`/integracoes?ml=${q}`, url.origin))

  if (url.searchParams.get('error')) return destino('recusado')
  const code = url.searchParams.get('code')
  const workspaceId = validarState(url.searchParams.get('state'))
  if (!workspaceId || !code) return destino('state')

  const r = await conectarComCode(workspaceId, code)
  return destino(r.ok ? 'ok' : 'erro')
}
