import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureMarketplaceTables } from '@/lib/marketplaceSchema'

// POST — baixa em LOTE por período: previsto/a_confirmar → recebido.
// ★ NÃO gera lançamento algum no financeiro. Só muda o status do recebível. ★
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  await ensureMarketplaceTables()
  const workspaceId = session.user.workspaceId
  const { canal, de, ate } = await req.json()
  const ch = canal || 'shopee'
  if (!de || !ate) return NextResponse.json({ error: 'Informe o período (de/ate)' }, { status: 400 })

  // Só recebíveis previstos (inclui a_confirmar = previsto vencido) dentro do período de data prevista
  const res = await prisma.$executeRaw`
    UPDATE "Recebivel"
    SET "status" = 'recebido', "updatedAt" = NOW()
    WHERE "workspaceId" = ${workspaceId} AND "canal" = ${ch}
      AND "status" = 'previsto'
      AND "dataPrevista" IS NOT NULL
      AND "dataPrevista" >= ${de}::date AND "dataPrevista" <= ${ate}::date
  `
  return NextResponse.json({ ok: true, baixados: Number(res) })
}
