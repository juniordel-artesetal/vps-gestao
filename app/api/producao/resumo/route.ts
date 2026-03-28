import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const workspaceId = session.user.workspaceId

    const [totais, porStatus, porPrioridade, porCanal, recentes] = await Promise.all([
      // Total geral
      prisma.$queryRaw`
        SELECT COUNT(*) as total,
               COUNT(*) FILTER (WHERE "status" = 'ABERTO') as abertos,
               COUNT(*) FILTER (WHERE "status" = 'EM_PRODUCAO') as em_producao,
               COUNT(*) FILTER (WHERE "status" = 'CONCLUIDO') as concluidos,
               COUNT(*) FILTER (WHERE "status" = 'CANCELADO') as cancelados
        FROM "Order"
        WHERE "workspaceId" = ${workspaceId}
      ` as Promise<any[]>,

      // Por status
      prisma.$queryRaw`
        SELECT "status", COUNT(*) as total
        FROM "Order"
        WHERE "workspaceId" = ${workspaceId}
        GROUP BY "status"
      ` as Promise<any[]>,

      // Por prioridade
      prisma.$queryRaw`
        SELECT "prioridade", COUNT(*) as total
        FROM "Order"
        WHERE "workspaceId" = ${workspaceId}
        AND "status" NOT IN ('CONCLUIDO', 'CANCELADO')
        GROUP BY "prioridade"
      ` as Promise<any[]>,

      // Por canal
      prisma.$queryRaw`
        SELECT "canal", COUNT(*) as total
        FROM "Order"
        WHERE "workspaceId" = ${workspaceId}
        AND "canal" IS NOT NULL
        GROUP BY "canal"
        ORDER BY total DESC
        LIMIT 5
      ` as Promise<any[]>,

      // Pedidos recentes
      prisma.$queryRaw`
        SELECT "id", "numero", "destinatario", "produto", "status", "prioridade", "canal", "dataEnvio", "createdAt"
        FROM "Order"
        WHERE "workspaceId" = ${workspaceId}
        ORDER BY "createdAt" DESC
        LIMIT 5
      ` as Promise<any[]>,
    ])

    return NextResponse.json({
      totais: totais[0],
      porStatus,
      porPrioridade,
      porCanal,
      recentes,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
