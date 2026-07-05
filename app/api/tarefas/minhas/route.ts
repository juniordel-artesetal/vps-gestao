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

// GET — tarefas do usuário logado, em todos os quadros
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const workspaceId = session.user.workspaceId
  const userId = session.user.id

  const rows = await prisma.$queryRaw`
    SELECT t."id", t."titulo", t."quadroId", t."prioridade",
           TO_CHAR(t."prazo",'YYYY-MM-DD') AS "prazo",
           q."nome" AS "quadroNome", q."cor" AS "quadroCor", col."nome" AS "colunaNome",
           c."nome" AS "clienteNome"
    FROM "Tarefa" t
    JOIN "TarefaQuadro" q ON q."id" = t."quadroId"
    LEFT JOIN "TarefaColuna" col ON col."id" = t."colunaId"
    LEFT JOIN "Cliente" c ON c."id" = t."clienteId"
    WHERE t."workspaceId" = ${workspaceId} AND t."responsavelId" = ${userId}
    ORDER BY (t."prazo" IS NULL), t."prazo" ASC, t."updatedAt" DESC
  ` as any[]
  return NextResponse.json(serialize(rows))
}
