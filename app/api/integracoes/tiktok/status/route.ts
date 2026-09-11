// Status da conexão TikTok da workspace logada (sem tokens). Inclui o gate da feature.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serialize } from '@/lib/serialize'
import { integracoesAtivo, statusConexao } from '@/lib/tiktok/conta'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!integracoesAtivo()) return NextResponse.json({ gate: false })
  return NextResponse.json({ gate: true, ...serialize(await statusConexao(session.user.workspaceId)) })
}
