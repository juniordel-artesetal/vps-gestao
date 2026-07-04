// app/api/clientes/visao-geral/route.ts — Dashboard/relatórios do módulo Clientes — VPS-20260630-NQA8
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (typeof obj === 'object' && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') {
    const r: any = {}
    for (const k of Object.keys(obj)) r[k] = serialize(obj[k])
    return r
  }
  return obj
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId

  const [cli] = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS "totalClientes",
      COUNT(*) FILTER (WHERE "ativo")::int AS "ativos",
      COUNT(*) FILTER (WHERE NOT "ativo")::int AS "inativos",
      COUNT(*) FILTER (WHERE "createdAt" >= date_trunc('month', now()))::int AS "novosMes"
    FROM "Cliente" WHERE "workspaceId" = ${workspaceId}
  ` as any[]

  const [ped] = await prisma.$queryRaw`
    SELECT
      COUNT(*) FILTER (WHERE o."clienteId" IS NOT NULL)::int AS "pedidosVinculados",
      COALESCE(SUM(o."valor") FILTER (WHERE o."clienteId" IS NOT NULL), 0)::float AS "totalVendas"
    FROM "Order" o WHERE o."workspaceId" = ${workspaceId}
  ` as any[]

  // Relatório completo: todos os clientes com nº de pedidos e valor total (ranking + export)
  const clientes = await prisma.$queryRaw`
    SELECT c."id", c."nome", c."origem", c."ativo",
      (SELECT COUNT(*)::int FROM "Order" o
        WHERE o."clienteId" = c."id" AND o."workspaceId" = c."workspaceId") AS "qtdPedidos",
      (SELECT COALESCE(SUM(o."valor"), 0)::float FROM "Order" o
        WHERE o."clienteId" = c."id" AND o."workspaceId" = c."workspaceId") AS "valorTotal"
    FROM "Cliente" c
    WHERE c."workspaceId" = ${workspaceId}
    ORDER BY "valorTotal" DESC, c."nome" ASC
  ` as any[]

  const porOrigem = await prisma.$queryRaw`
    SELECT COALESCE(NULLIF("origem", ''), '(sem origem)') AS "origem", COUNT(*)::int AS "qtd"
    FROM "Cliente" WHERE "workspaceId" = ${workspaceId}
    GROUP BY COALESCE(NULLIF("origem", ''), '(sem origem)')
    ORDER BY "qtd" DESC
  ` as any[]

  const pedidosVinculados = Number(ped?.pedidosVinculados || 0)
  const totalVendas = Number(ped?.totalVendas || 0)

  return NextResponse.json(serialize({
    metricas: {
      totalClientes: cli?.totalClientes || 0,
      ativos: cli?.ativos || 0,
      inativos: cli?.inativos || 0,
      novosMes: cli?.novosMes || 0,
      pedidosVinculados,
      totalVendas,
      ticketMedioGeral: pedidosVinculados > 0 ? totalVendas / pedidosVinculados : 0,
    },
    porOrigem,
    clientes,
  }))
}
