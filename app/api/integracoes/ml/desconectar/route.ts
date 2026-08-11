// Desconecta a conta ML da workspace logada (apaga os tokens).
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { desconectar } from '@/lib/mercadolivre/conta'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  await desconectar(session.user.workspaceId)
  return NextResponse.json({ ok: true })
}
