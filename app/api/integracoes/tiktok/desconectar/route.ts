// Desconecta a conta TikTok da workspace logada (apaga os tokens e o cipher).
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { integracoesAtivo, desconectar } from '@/lib/tiktok/conta'

export const dynamic = 'force-dynamic'

export async function POST() {
  if (!integracoesAtivo())
    return NextResponse.json({ error: 'Integração indisponível.' }, { status: 404 })
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  await desconectar(session.user.workspaceId)
  return NextResponse.json({ ok: true })
}
