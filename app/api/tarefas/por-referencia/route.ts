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

// GET ?tipo=&referenciaId= — tarefas vinculadas a uma referência (reverso), workspace-scoped
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const workspaceId = session.user.workspaceId
  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get('tipo')
  const referenciaId = searchParams.get('referenciaId')
  if (!tipo || !referenciaId) return NextResponse.json([])

  const rows = await prisma.$queryRaw`
    SELECT t."id", t."titulo", t."quadroId", t."prioridade",
           TO_CHAR(t."prazo",'YYYY-MM-DD') AS "prazo", col."nome" AS "colunaNome"
    FROM "TarefaVinculo" v
    JOIN "Tarefa" t ON t."id" = v."tarefaId"
    LEFT JOIN "TarefaColuna" col ON col."id" = t."colunaId"
    WHERE v."workspaceId" = ${workspaceId} AND v."tipo" = ${tipo} AND v."referenciaId" = ${referenciaId}
    ORDER BY t."updatedAt" DESC
  ` as any[]
  return NextResponse.json(serialize(rows))
}
