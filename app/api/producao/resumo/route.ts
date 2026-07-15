// app/api/producao/resumo/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sqlEhPronto } from '@/lib/statusPedido'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId

  try {
    // Totais por status
    const totaisRaw = await prisma.$queryRaw`
      SELECT
        COUNT(*)::int                                                          AS total,
        COUNT(*) FILTER (WHERE status = 'ABERTO')::int                        AS abertos,
        COUNT(*) FILTER (WHERE status = 'EM_PRODUCAO')::int                   AS em_producao,
        COUNT(*) FILTER (WHERE ${sqlEhPronto(Prisma.sql`status`)})::int       AS prontos,
        COUNT(*) FILTER (WHERE status = 'ENVIADO')::int                       AS enviados,
        COUNT(*) FILTER (WHERE status = 'CANCELADO')::int                     AS cancelados
      FROM "Order"
      WHERE "workspaceId" = ${workspaceId}
    ` as any[]

    // Por canal
    const porCanal = await prisma.$queryRaw`
      SELECT canal, COUNT(*)::int AS total
      FROM "Order"
      WHERE "workspaceId" = ${workspaceId}
        AND canal IS NOT NULL
        AND status NOT IN ('CANCELADO')
      GROUP BY canal
      ORDER BY total DESC
    ` as any[]

    // Por prioridade (apenas abertos e em produção)
    const porPrioridade = await prisma.$queryRaw`
      SELECT prioridade, COUNT(*)::int AS total
      FROM "Order"
      WHERE "workspaceId" = ${workspaceId}
        AND status IN ('ABERTO', 'EM_PRODUCAO')
      GROUP BY prioridade
    ` as any[]

    // Por setor — pedidos ativos em cada setor
    const porSetor = await prisma.$queryRaw`
      SELECT
        sc.id        AS "setorId",
        sc.nome      AS "setorNome",
        COUNT(*)::int AS total
      FROM "PedidoSetor" ps
      JOIN "SetorConfig" sc ON sc.id = ps."setorId"
      JOIN "Order" o ON o.id = ps."pedidoId"
      WHERE ps."workspaceId" = ${workspaceId}
        AND ps.status IN ('EM_ANDAMENTO', 'DEVOLVIDO')
        -- Inclui CONCLUIDO: pedido PRONTO (produção terminada, aguardando expedir) ainda está
        -- ativo no setor de expedição (ps.status = EM_ANDAMENTO). Exclui só enviados/cancelados.
        AND o.status NOT IN ('CANCELADO', 'ENVIADO')
      GROUP BY sc.id, sc.nome, sc.ordem
      ORDER BY sc.ordem ASC
    ` as any[]

    // Últimos 10 pedidos
    const recentes = await prisma.$queryRaw`
      SELECT id, numero, destinatario, produto, status, prioridade, "dataEnvio", canal
      FROM "Order"
      WHERE "workspaceId" = ${workspaceId}
      ORDER BY "createdAt" DESC
      LIMIT 10
    ` as any[]

    return NextResponse.json({
      totais:       serialize(totaisRaw[0]),
      porCanal:     serialize(porCanal),
      porPrioridade: serialize(porPrioridade),
      porSetor:     serialize(porSetor),
      recentes:     serialize(recentes),
    })
  } catch (err) {
    console.error('[GET /api/producao/resumo]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
