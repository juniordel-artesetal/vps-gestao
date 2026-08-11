// Webhook de NOTIFICAÇÕES do Mercado Livre (topics orders_v2/payments).
// ML manda { resource, user_id, topic, ... } e espera 200 rápido. Idempotente: o
// sync usa upsert, então reprocessar é seguro. Responde 200 sempre (ML reenvia em erro).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sincronizarPedidosML } from '@/lib/mercadolivre/pedidos'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  let body: any = {}
  try { body = await req.json() } catch {}
  const userId = body?.user_id != null ? String(body.user_id) : null
  const topic = String(body?.topic || '')

  // Só reage a pedidos. Acha a workspace conectada por seller_id (= user_id do ML).
  if (userId && (topic.includes('order') || topic.includes('payment'))) {
    try {
      const [c] = await prisma.$queryRaw`
        SELECT "workspaceId" FROM "MLConexao" WHERE "sellerId" = ${userId} AND "conectado" = true LIMIT 1
      ` as { workspaceId: string }[]
      if (c?.workspaceId) {
        // Sync leve (idempotente). Não bloqueia a resposta por muito tempo.
        await sincronizarPedidosML(c.workspaceId, { limite: 20 })
      }
    } catch (e) { console.error('[ML][webhook]', String(e).slice(0, 200)) }
  }
  // Sempre 200 — senão o ML fica reenviando.
  return NextResponse.json({ ok: true })
}

export async function GET() { return NextResponse.json({ ok: true }) }
