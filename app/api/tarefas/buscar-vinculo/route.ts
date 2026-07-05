import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
const brl = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })

// GET ?tipo=pedido|pagamento&q= — candidatos para vincular (workspace-scoped)
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const workspaceId = session.user.workspaceId
  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get('tipo')
  const q = (searchParams.get('q') || '').trim()
  const like = `%${q}%`

  if (tipo === 'pedido') {
    const rows = await prisma.$queryRaw`
      SELECT "id" AS "referenciaId", "numero", "destinatario", "valor"::float AS "valor"
      FROM "Order"
      WHERE "workspaceId" = ${workspaceId}
        AND (${q} = '' OR "numero" ILIKE ${like} OR "destinatario" ILIKE ${like})
      ORDER BY "createdAt" DESC LIMIT 12
    ` as any[]
    return NextResponse.json(rows.map((o: any) => ({ referenciaId: o.referenciaId, rotulo: `#${o.numero}${o.destinatario ? ' · ' + o.destinatario : ''}` })))
  }

  if (tipo === 'pagamento') {
    const rows = await prisma.$queryRaw`
      SELECT pg."id" AS "referenciaId", pg."valor"::float AS "valor", pg."provedor", pg."status", o."numero"
      FROM "Pagamento" pg LEFT JOIN "Order" o ON o."id" = pg."orderId"
      WHERE pg."workspaceId" = ${workspaceId}
        AND (${q} = '' OR o."numero" ILIKE ${like} OR pg."provedor" ILIKE ${like})
      ORDER BY pg."createdAt" DESC LIMIT 12
    ` as any[]
    return NextResponse.json(rows.map((pg: any) => ({ referenciaId: pg.referenciaId, rotulo: `${brl(pg.valor)} · ${pg.provedor}${pg.numero ? ' · #' + pg.numero : ''} (${pg.status})` })))
  }

  return NextResponse.json([])
}
