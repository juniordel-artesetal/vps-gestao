// Webhook do TikTok Shop (notificações de pedido). O TikTok manda POST com assinatura
// no header Authorization e espera 200 rápido. Verificamos a assinatura ANTES de agir;
// assinatura inválida → 200 sem processar (não vaza nada, não gera retry storm). O sync
// é idempotente (upsert), então reprocessar é seguro. Registrar esta URL no "Registro do
// Webhook" do TikTok: https://www.usesoa.com.br/api/integracoes/tiktok/webhook
import { NextRequest, NextResponse } from 'next/server'
import { integracoesAtivo, verificarAssinaturaWebhook, workspacePorShopId } from '@/lib/tiktok/conta'
import { sincronizarPedidosTikTok } from '@/lib/tiktok/pedidos'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  // Lê o corpo BRUTO (a assinatura é sobre o texto exato recebido).
  const raw = await req.text().catch(() => '')
  const ok = verificarAssinaturaWebhook(raw, req.headers.get('authorization'))
  if (!ok || !integracoesAtivo()) {
    // Assinatura inválida ou feature desligada: aceita (200) mas não processa.
    return NextResponse.json({ ok: true })
  }

  try {
    const body = raw ? JSON.parse(raw) : {}
    const shopId = body?.shop_id != null ? String(body.shop_id) : null
    const tipo = Number(body?.type ?? 0)
    // type 1 = ORDER_STATUS_UPDATE (e afins). Só reagimos a eventos de pedido.
    if (shopId && (tipo === 1 || String(body?.type || '').toUpperCase().includes('ORDER'))) {
      const workspaceId = await workspacePorShopId(shopId)
      if (workspaceId) await sincronizarPedidosTikTok(workspaceId, { limite: 20 })
    }
  } catch (e) {
    console.error('[TIKTOK][webhook]', String(e).slice(0, 200))
  }
  // Sempre 200 — senão o TikTok fica reenviando.
  return NextResponse.json({ ok: true })
}

export async function GET() { return NextResponse.json({ ok: true }) }
