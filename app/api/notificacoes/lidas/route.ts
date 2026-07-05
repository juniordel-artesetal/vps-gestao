import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// POST — marca como lidas as notificações persistidas do usuário logado (ex.: menções)
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  await prisma.$executeRaw`
    UPDATE "Notificacao" SET "lida" = true
    WHERE "workspaceId" = ${session.user.workspaceId} AND "userId" = ${session.user.id} AND "lida" = false
  `
  return NextResponse.json({ ok: true })
}
