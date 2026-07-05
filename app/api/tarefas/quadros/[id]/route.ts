import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// PUT — renomeia / muda cor do quadro
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId
  const { nome, cor } = await req.json()

  if (nome !== undefined && String(nome).trim())
    await prisma.$executeRaw`UPDATE "TarefaQuadro" SET "nome"=${String(nome).trim()} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
  if (cor !== undefined)
    await prisma.$executeRaw`UPDATE "TarefaQuadro" SET "cor"=${cor || null} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
  return NextResponse.json({ ok: true })
}

// DELETE — remove o quadro e tudo dentro (colunas, tarefas, anexos, comentários, histórico)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId

  // Confirma que o quadro é do workspace
  const dono = await prisma.$queryRaw`
    SELECT "id" FROM "TarefaQuadro" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId} LIMIT 1
  ` as any[]
  if (!dono.length) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  // Cascata (isolado por workspaceId em todas)
  await prisma.$executeRaw`DELETE FROM "TarefaAnexo" WHERE "workspaceId"=${workspaceId} AND "tarefaId" IN (SELECT "id" FROM "Tarefa" WHERE "quadroId"=${id})`
  await prisma.$executeRaw`DELETE FROM "TarefaComentario" WHERE "workspaceId"=${workspaceId} AND "tarefaId" IN (SELECT "id" FROM "Tarefa" WHERE "quadroId"=${id})`
  await prisma.$executeRaw`DELETE FROM "TarefaHistorico" WHERE "workspaceId"=${workspaceId} AND "tarefaId" IN (SELECT "id" FROM "Tarefa" WHERE "quadroId"=${id})`
  await prisma.$executeRaw`DELETE FROM "Tarefa" WHERE "workspaceId"=${workspaceId} AND "quadroId"=${id}`
  await prisma.$executeRaw`DELETE FROM "TarefaColuna" WHERE "workspaceId"=${workspaceId} AND "quadroId"=${id}`
  await prisma.$executeRaw`DELETE FROM "TarefaQuadro" WHERE "workspaceId"=${workspaceId} AND "id"=${id}`
  return NextResponse.json({ ok: true })
}
