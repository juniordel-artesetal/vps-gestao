import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

// GET ?dias= — KPIs de tarefas do workspace
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const workspaceId = session.user.workspaceId
  const { searchParams } = new URL(req.url)
  const diasRaw = Number(searchParams.get('dias'))
  const dias = [7, 30, 90, 365].includes(diasRaw) ? diasRaw : 30

  const [kpi] = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS "total",
      COUNT(*) FILTER (WHERE "prazo" IS NOT NULL AND "prazo" < CURRENT_DATE)::int AS "vencidas",
      COUNT(*) FILTER (WHERE "prazo" IS NOT NULL AND "prazo" >= CURRENT_DATE AND "prazo" <= CURRENT_DATE + 7)::int AS "proximas",
      COUNT(*) FILTER (WHERE "prioridade" = 'urgente')::int AS "urgentes",
      COUNT(*) FILTER (WHERE "createdAt" >= NOW() - ($2::int || ' days')::interval)::int AS "novasPeriodo"
    FROM "Tarefa" WHERE "workspaceId" = $1
  `, workspaceId, dias) as any[]

  const porColuna = await prisma.$queryRaw`
    SELECT col."nome", col."cor", COUNT(t."id")::int AS "n"
    FROM "TarefaColuna" col
    LEFT JOIN "Tarefa" t ON t."colunaId" = col."id" AND t."workspaceId" = ${workspaceId}
    WHERE col."workspaceId" = ${workspaceId}
    GROUP BY col."nome", col."cor"
    HAVING COUNT(t."id") > 0
    ORDER BY "n" DESC LIMIT 10
  ` as any[]

  const porResponsavel = await prisma.$queryRaw`
    SELECT COALESCE(u."nome", 'Sem responsável') AS "nome", COUNT(t."id")::int AS "n"
    FROM "Tarefa" t LEFT JOIN "User" u ON u."id" = t."responsavelId"
    WHERE t."workspaceId" = ${workspaceId}
    GROUP BY u."nome" ORDER BY "n" DESC LIMIT 8
  ` as any[]

  const vencidasLista = await prisma.$queryRaw`
    SELECT t."id", t."titulo", t."quadroId", TO_CHAR(t."prazo",'YYYY-MM-DD') AS "prazo", t."prioridade"
    FROM "Tarefa" t
    WHERE t."workspaceId" = ${workspaceId} AND t."prazo" IS NOT NULL AND t."prazo" < CURRENT_DATE
    ORDER BY t."prazo" ASC LIMIT 10
  ` as any[]

  return NextResponse.json(serialize({
    dias,
    kpis: {
      total: Number(kpi?.total || 0), vencidas: Number(kpi?.vencidas || 0),
      proximas: Number(kpi?.proximas || 0), urgentes: Number(kpi?.urgentes || 0),
      novasPeriodo: Number(kpi?.novasPeriodo || 0),
    },
    porColuna, porResponsavel, vencidasLista,
  }))
}
