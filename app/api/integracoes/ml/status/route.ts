// Status da conexão ML da workspace logada (sem tokens).
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serialize } from '@/lib/serialize'
import { statusConexao } from '@/lib/mercadolivre/conta'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  return NextResponse.json(serialize(await statusConexao(session.user.workspaceId)))
}
