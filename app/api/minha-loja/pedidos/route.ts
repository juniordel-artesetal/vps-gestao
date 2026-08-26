import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

// GET — pedidos da loja (canal 'Loja'), workspace-scoped, com status de pagamento.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { searchParams } = new URL(req.url)
  const filtroPag = searchParams.get('pagamento') // 'pago' | 'aguardando' | null

  const filtro = filtroPag === 'pago' || filtroPag === 'aguardando' ? filtroPag : null

  const rows = await prisma.$queryRawUnsafe(`
    SELECT o."id", o."numero", o."destinatario", o."valor"::float AS "valor",
           o."status", o."statusPagamento", o."metodoPagamento",
           (o."comprovante" IS NOT NULL) AS "temComprovante",
           o."createdAt",
           TO_CHAR(o."dataEnvio", 'YYYY-MM-DD') AS "dataEnvio",
           COALESCE(o."camposExtras"::jsonb->'loja'->>'aprovacao', 'pendente') AS "aprovacao",
           o."camposExtras"::jsonb->>'contato' AS "contato"
    FROM "Order" o
    WHERE o."workspaceId" = $1 AND o."canal" = 'Loja'
      AND ($2::text IS NULL OR o."statusPagamento" = $2)
    ORDER BY o."createdAt" DESC
    LIMIT 200
  `, workspaceId, filtro) as any[]

  return NextResponse.json(serialize(rows))
}
