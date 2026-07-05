import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// POST — reordena colunas de um quadro. body: { ids: [colunaId...] } na nova ordem.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { ids } = await req.json()
  if (!Array.isArray(ids)) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  for (let i = 0; i < ids.length; i++) {
    await prisma.$executeRaw`UPDATE "TarefaColuna" SET "ordem"=${i} WHERE "id"=${String(ids[i])} AND "workspaceId"=${workspaceId}`
  }
  return NextResponse.json({ ok: true })
}
