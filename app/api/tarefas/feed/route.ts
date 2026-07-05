import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

// GET ?quadroId= (opcional) — feed de atividades (TarefaHistorico) do workspace
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const ws = session.user.workspaceId
  const quadroId = new URL(req.url).searchParams.get('quadroId')

  const rows = quadroId
    ? await prisma.$queryRaw`
        SELECT h."id", h."tipo", h."descricao", h."usuarioNome", h."createdAt",
               t."id" AS "tarefaId", t."titulo" AS "tarefaTitulo", t."quadroId"
        FROM "TarefaHistorico" h JOIN "Tarefa" t ON t."id" = h."tarefaId"
        WHERE h."workspaceId" = ${ws} AND t."quadroId" = ${quadroId}
        ORDER BY h."createdAt" DESC LIMIT 60
      ` as any[]
    : await prisma.$queryRaw`
        SELECT h."id", h."tipo", h."descricao", h."usuarioNome", h."createdAt",
               t."id" AS "tarefaId", t."titulo" AS "tarefaTitulo", t."quadroId"
        FROM "TarefaHistorico" h JOIN "Tarefa" t ON t."id" = h."tarefaId"
        WHERE h."workspaceId" = ${ws}
        ORDER BY h."createdAt" DESC LIMIT 60
      ` as any[]

  return NextResponse.json(serialize(rows))
}
