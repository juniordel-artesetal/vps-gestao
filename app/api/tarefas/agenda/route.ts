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

// GET — tarefas COM prazo (para o calendário), workspace-scoped
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const rows = await prisma.$queryRaw`
    SELECT t."id", t."titulo", t."quadroId", t."prioridade",
           TO_CHAR(t."prazo",'YYYY-MM-DD') AS "prazo", q."cor" AS "quadroCor"
    FROM "Tarefa" t JOIN "TarefaQuadro" q ON q."id" = t."quadroId"
    WHERE t."workspaceId" = ${session.user.workspaceId} AND t."prazo" IS NOT NULL
    ORDER BY t."prazo" ASC LIMIT 500
  ` as any[]
  return NextResponse.json(serialize(rows))
}
