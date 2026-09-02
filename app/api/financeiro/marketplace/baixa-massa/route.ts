import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureMarketplaceTables } from '@/lib/marketplaceSchema'
import { sincronizarReceitasRecebivel } from '@/lib/marketplace/recebivelFluxo'

// POST — baixa em LOTE de pedidos SELECIONADOS (por id de PedidoMarketplace).
// Mesma regra da baixa unitária (PUT pedidos/[id]): recebível 'previsto' → 'recebido' + espelho
// no fluxo de caixa vira REALIZADO (PAGO), via sincronizarReceitasRecebivel. IDEMPOTENTE: pedido
// já 'recebido' é ignorado (não duplica no caixa). Só baixa elegíveis; reporta o que aconteceu.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  await ensureMarketplaceTables()
  const workspaceId = session.user.workspaceId

  const body = await req.json().catch(() => ({}))
  const ids: string[] = Array.isArray(body?.ids) ? ([...new Set(body.ids.filter((x: any) => typeof x === 'string'))] as string[]).slice(0, 1000) : []
  if (!ids.length) return NextResponse.json({ error: 'Selecione ao menos um pedido' }, { status: 400 })

  // Estado atual do recebível de cada pedido selecionado (por id de PedidoMarketplace).
  const rows = await prisma.$queryRaw`
    SELECT pm."id" AS "pmId", pm."orderId", r."status" AS "recStatus"
    FROM "PedidoMarketplace" pm
    LEFT JOIN "Recebivel" r ON r."orderId" = pm."orderId" AND r."workspaceId" = pm."workspaceId"
    WHERE pm."workspaceId" = ${workspaceId} AND pm."id" = ANY(${ids}::text[])
  ` as { pmId: string; orderId: string | null; recStatus: string | null }[]

  const encontrados = new Set(rows.map(r => r.pmId))
  // Elegível = recebível 'previsto' (inclui o 'a_confirmar' da tela, que é previsto vencido).
  const elegiveis = rows.filter(r => r.orderId && r.recStatus === 'previsto') as { orderId: string }[]
  const jaEstavam = rows.filter(r => r.recStatus === 'recebido').length
  const naoEncontrados = ids.filter((id: string) => !encontrados.has(id)).length
  const invalidos = rows.filter(r => r.recStatus !== 'previsto' && r.recStatus !== 'recebido').length + naoEncontrados

  let baixados = 0
  if (elegiveis.length) {
    const orderIds = elegiveis.map(r => r.orderId)
    // A condição status='previsto' garante idempotência mesmo com corrida (já recebido não é tocado).
    const upd = await prisma.$queryRaw`
      UPDATE "Recebivel" SET "status" = 'recebido', "updatedAt" = NOW()
      WHERE "workspaceId" = ${workspaceId} AND "orderId" = ANY(${orderIds}::text[]) AND "status" = 'previsto'
      RETURNING "orderId"
    ` as { orderId: string }[]
    baixados = upd.length
    // Espelha no caixa (RECEITA → PAGO) — mesma função da baixa unitária/por período.
    await sincronizarReceitasRecebivel(workspaceId, upd.map(u => u.orderId).filter(Boolean))
  }

  return NextResponse.json({ ok: true, baixados, jaEstavam, invalidos, total: ids.length })
}
