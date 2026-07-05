import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// PUT — renomeia / muda cor da coluna
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId
  const { nome, cor } = await req.json()

  if (nome !== undefined && String(nome).trim())
    await prisma.$executeRaw`UPDATE "TarefaColuna" SET "nome"=${String(nome).trim()} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
  if (cor !== undefined)
    await prisma.$executeRaw`UPDATE "TarefaColuna" SET "cor"=${cor || null} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
  return NextResponse.json({ ok: true })
}

// DELETE — remove coluna (só se estiver vazia)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId

  const [{ n }] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS n FROM "Tarefa" WHERE "colunaId"=${id} AND "workspaceId"=${workspaceId}
  ` as any[]
  if (Number(n) > 0) return NextResponse.json({ error: 'Mova ou remova as tarefas antes de excluir a coluna.' }, { status: 400 })

  await prisma.$executeRaw`DELETE FROM "TarefaColuna" WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
  return NextResponse.json({ ok: true })
}
