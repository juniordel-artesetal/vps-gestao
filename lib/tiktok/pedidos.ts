// Sync SÓ-LEITURA de pedidos do TikTok Shop → PedidoMarketplace/PedidoMarketplaceItem
// (canal 'tiktokshop'). Idempotente por (workspaceId,'tiktokshop',idExterno). Quando o
// canal está ativo em MarketplaceConfig, também cria o Order + Recebível (mesmo caminho
// da Shopee/ML) respeitando o opt-in financeiro. Sem conexão → não faz nada (fallback).
//
// ⚠️ O mapeamento dos campos do pedido segue a doc do TikTok Shop (Order API 202309);
// como não dá para exercitar a API real aqui, o parsing é DEFENSIVO (optional chaining
// + fallbacks) e deve ser conferido contra a loja de teste na 1ª sincronização real.
import { prisma } from '@/lib/prisma'
import { getAccessTokenValido, shopCipherDe, assinarRequisicao, credenciaisConfiguradas } from '@/lib/tiktok/conta'
import { TIKTOK_ENDPOINTS } from '@/lib/tiktok/config'
import { ensurePedidoMarketplaceTables } from '@/app/api/importacao/pedidos/_lib/schema'
import { criarRecebivelSeCanalAtivo } from '@/lib/marketplace/recebivelFluxo'

const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const r2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
const CANAL_SLUG = 'tiktokshop'
const CANAL_LABEL = 'TikTok Shop'

let colsOk = false
async function ensureCols(): Promise<void> {
  if (colsOk) return
  await ensurePedidoMarketplaceTables()
  await prisma.$executeRawUnsafe(`ALTER TABLE "PedidoMarketplaceItem" ADD COLUMN IF NOT EXISTS "saleFee" NUMERIC`)
  colsOk = true
}

function paraDataSeg(v: any): Date | null {
  const n = Number(v) || 0
  if (n <= 0) return null
  return new Date(n > 1_000_000_000_000 ? n : n * 1000) // aceita ms ou s
}

export interface ResultadoSyncTikTok { ok: boolean; motivo?: string; encontrados: number; importados: number }

export async function sincronizarPedidosTikTok(workspaceId: string, opts: { limite?: number } = {}): Promise<ResultadoSyncTikTok> {
  await ensureCols()
  if (!credenciaisConfiguradas()) return { ok: false, motivo: 'Credenciais do TikTok não configuradas.', encontrados: 0, importados: 0 }
  const token = await getAccessTokenValido(workspaceId)
  if (!token) return { ok: false, motivo: 'Loja do TikTok não conectada.', encontrados: 0, importados: 0 }
  const cipher = await shopCipherDe(workspaceId)
  if (!cipher) return { ok: false, motivo: 'Loja sem shop_cipher — reconecte.', encontrados: 0, importados: 0 }

  const pageSize = Math.min(Math.max(Number(opts.limite) || 50, 1), 100)
  const path = '/order/202309/orders/search'
  // Filtro padrão: pedidos atualizados nos últimos 30 dias (a API costuma exigir janela).
  const body = JSON.stringify({ update_time_ge: Math.floor(Date.now() / 1000) - 30 * 24 * 3600 })
  const params: Record<string, string> = {
    app_key: process.env.TIKTOK_APP_KEY || '',
    timestamp: String(Math.floor(Date.now() / 1000)),
    shop_cipher: cipher,
    page_size: String(pageSize),
    sort_field: 'update_time',
    sort_order: 'DESC',
  }
  params.sign = assinarRequisicao(path, params, body)

  let pedidos: any[] = []
  try {
    const url = `${TIKTOK_ENDPOINTS.apiBase}${path}?${new URLSearchParams(params).toString()}`
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 15000)
    const r = await fetch(url, {
      method: 'POST', signal: ctrl.signal, body,
      headers: { 'content-type': 'application/json', 'x-tts-access-token': token },
    })
    clearTimeout(t)
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok || j?.code !== 0) {
      console.error(`[TIKTOK][sync] busca falhou ws=${workspaceId}: code=${j?.code} msg=${j?.message || r.status}`)
      return { ok: false, motivo: `TikTok respondeu ${j?.message || r.status}.`, encontrados: 0, importados: 0 }
    }
    pedidos = j?.data?.orders || j?.data?.order_list || []
  } catch {
    return { ok: false, motivo: 'Erro ao consultar pedidos no TikTok.', encontrados: 0, importados: 0 }
  }

  let importados = 0
  for (const o of pedidos) {
    try { await gravarPedidoTikTok(workspaceId, o); importados++ }
    catch (e) { console.error('[TIKTOK][sync pedido]', String(e).slice(0, 200)) }
  }
  return { ok: true, encontrados: pedidos.length, importados }
}

// Mapeia 1 pedido do TikTok e faz upsert idempotente. Exportada para teste com payload mock.
export async function gravarPedidoTikTok(workspaceId: string, o: any): Promise<void> {
  await ensureCols()
  const idExterno = String(o?.id ?? o?.order_id ?? '')
  if (!idExterno) return
  const itens: any[] = Array.isArray(o?.line_items) ? o.line_items : []
  const valorTotal = r2(
    Number(o?.payment?.total_amount)
    || itens.reduce((s, it) => s + (Number(it?.sale_price) || 0) * (Number(it?.quantity) || 1), 0),
  )
  const status = o?.status ?? o?.order_status ?? null
  const dataCriacao = paraDataSeg(o?.create_time)
  const dataPagamento = paraDataSeg(o?.paid_time) || paraDataSeg(o?.update_time)
  const destinatario = o?.recipient_address?.name ?? o?.buyer_email ?? null
  const qtdTotal = Math.max(1, itens.reduce((s, it) => s + (Number(it?.quantity) || 1), 0))
  const produtos = itens.map(it => it?.product_name || it?.sku_name).filter(Boolean).join(' + ') || 'Pedido TikTok Shop'

  const rows = await prisma.$queryRaw`
    INSERT INTO "PedidoMarketplace" (
      "id","workspaceId","orderId","canal","idExterno","statusExterno",
      "dataCriacaoExterna","dataPagamento","valorTotal","totalGlobal",
      "comissaoLiquida","liquidoEstimado","destinatarioNome","createdAt","updatedAt"
    ) VALUES (
      ${gerarId()}, ${workspaceId}, ${null}, ${CANAL_SLUG}, ${idExterno}, ${status},
      ${dataCriacao}, ${dataPagamento}, ${valorTotal}, ${valorTotal},
      ${null}, ${valorTotal}, ${destinatario}, NOW(), NOW()
    )
    ON CONFLICT ("workspaceId","canal","idExterno") DO UPDATE SET
      "statusExterno"   = EXCLUDED."statusExterno",
      "dataPagamento"   = EXCLUDED."dataPagamento",
      "valorTotal"      = EXCLUDED."valorTotal",
      "totalGlobal"     = EXCLUDED."totalGlobal",
      "liquidoEstimado" = EXCLUDED."liquidoEstimado",
      "updatedAt"       = NOW()
    RETURNING "id"
  ` as { id: string }[]
  const pmId = rows[0]?.id
  if (!pmId) return

  // Order + Recebível (mesmo caminho da Shopee/ML) — OPT-IN por canal em MarketplaceConfig.
  const [cfg] = await prisma.$queryRaw`
    SELECT "ativo" FROM "MarketplaceConfig"
    WHERE "workspaceId" = ${workspaceId} AND "canal" = ${CANAL_SLUG} LIMIT 1
  ` as { ativo: boolean }[]
  if (cfg?.ativo) {
    const numero = `TT-${idExterno}`
    const [ja] = await prisma.$queryRaw`
      SELECT "id" FROM "Order" WHERE "workspaceId" = ${workspaceId} AND "numero" = ${numero} LIMIT 1
    ` as { id: string }[]
    let orderId = ja?.id
    if (orderId) {
      await prisma.$executeRaw`
        UPDATE "Order" SET "valor" = ${valorTotal}, "updatedAt" = NOW()
        WHERE "id" = ${orderId} AND "workspaceId" = ${workspaceId}
      `
    } else {
      orderId = gerarId()
      await prisma.$executeRaw`
        INSERT INTO "Order"
          ("id","workspaceId","numero","destinatario","canal","produto","quantidade","valor",
           "prioridade","status","dataEntrada","createdAt","updatedAt")
        VALUES
          (${orderId}, ${workspaceId}, ${numero}, ${destinatario ?? 'Comprador TikTok Shop'},
           ${CANAL_LABEL}, ${produtos}, ${qtdTotal}, ${valorTotal},
           'NORMAL', 'ABERTO', ${dataCriacao ?? new Date()}, NOW(), NOW())
      `
    }
    if (orderId) {
      await prisma.$executeRaw`UPDATE "PedidoMarketplace" SET "orderId" = ${orderId}, "updatedAt" = NOW() WHERE "id" = ${pmId}`
      // Previsão pura (líquido = bruto − taxa do canal, fonte única da precificação).
      // A promoção p/ 'previsto' e a receita acontecem na expedição/baixa do Order.
      await criarRecebivelSeCanalAtivo(workspaceId, orderId, CANAL_LABEL, valorTotal)
    }
  }

  // Itens (substitui a lista — idempotente).
  await prisma.$executeRaw`DELETE FROM "PedidoMarketplaceItem" WHERE "pedidoMarketplaceId" = ${pmId} AND "workspaceId" = ${workspaceId}`
  for (const it of itens) {
    const qtd = Math.max(1, Math.round(Number(it?.quantity) || 1))
    const preco = Number(it?.sale_price) || 0
    const skuBruto = it?.seller_sku ?? it?.sku_id
    const sku = skuBruto != null ? String(skuBruto) : null
    await prisma.$executeRaw`
      INSERT INTO "PedidoMarketplaceItem" (
        "id","pedidoMarketplaceId","workspaceId","produto","sku","variacao","qtd","precoAcordado","subtotal","saleFee"
      ) VALUES (
        ${gerarId()}, ${pmId}, ${workspaceId}, ${it?.product_name ?? it?.sku_name ?? null},
        ${sku}, ${it?.sku_name ?? null}, ${qtd}, ${preco}, ${r2(preco * qtd)}, ${null}
      )
    `
  }
}
