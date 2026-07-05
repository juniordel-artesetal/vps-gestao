import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
function novoId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// POST — move/reordena um card. body: { tarefaId, colunaId, ids: [ordem da coluna destino] }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const workspaceId = session.user.workspaceId
  const { tarefaId, colunaId, ids } = await req.json()
  if (!tarefaId || !colunaId || !Array.isArray(ids)) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const [tarefa] = await prisma.$queryRaw`
    SELECT "id","colunaId","quadroId" FROM "Tarefa" WHERE "id"=${tarefaId} AND "workspaceId"=${workspaceId} LIMIT 1
  ` as any[]
  if (!tarefa) return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })

  // Confirma coluna destino no mesmo quadro/workspace
  const [colDest] = await prisma.$queryRaw`
    SELECT "id","nome" FROM "TarefaColuna" WHERE "id"=${colunaId} AND "quadroId"=${tarefa.quadroId} AND "workspaceId"=${workspaceId} LIMIT 1
  ` as any[]
  if (!colDest) return NextResponse.json({ error: 'Coluna inválida' }, { status: 400 })

  const mudouColuna = tarefa.colunaId !== colunaId

  // Reescreve ordem da coluna destino (e garante colunaId nos cards listados)
  for (let i = 0; i < ids.length; i++) {
    await prisma.$executeRaw`
      UPDATE "Tarefa" SET "colunaId"=${colunaId}, "ordem"=${i}, "updatedAt"=NOW()
      WHERE "id"=${String(ids[i])} AND "workspaceId"=${workspaceId} AND "quadroId"=${tarefa.quadroId}
    `
  }
  // Garante que o card movido está na coluna (mesmo que ids não o inclua por algum motivo)
  await prisma.$executeRaw`
    UPDATE "Tarefa" SET "colunaId"=${colunaId}, "updatedAt"=NOW()
    WHERE "id"=${tarefaId} AND "workspaceId"=${workspaceId}
  `

  if (mudouColuna) {
    const usuario = session.user.name || session.user.email || 'Usuária'
    await prisma.$executeRaw`
      INSERT INTO "TarefaHistorico" ("id","tarefaId","workspaceId","tipo","descricao","usuarioNome","createdAt")
      VALUES (${novoId()}, ${tarefaId}, ${workspaceId}, 'movida', ${'Movida para ' + colDest.nome}, ${usuario}, NOW())
    `
  }
  return NextResponse.json({ ok: true })
}
