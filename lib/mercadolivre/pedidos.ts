// Sync de pedidos do Mercado Livre via API → PedidoMarketplace/PedidoMarketplaceItem
// (canal 'mercadolivre'), com a sale_fee REAL por item. Idempotente por
// (workspaceId,'mercadolivre',idExterno). Sem conexão → não faz nada (fallback).
import { prisma } from '@/lib/prisma'
import { getAccessTokenValido } from '@/lib/mercadolivre/conta'
import { ensurePedidoMarketplaceTables } from '@/app/api/importacao/pedidos/_lib/schema'

const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const r2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

// Coluna de sale_fee por item (não existia — Shopee guardava taxa só no pedido).
let colsOk = false
export async function ensureMLPedidoCols(): Promise<void> {
  if (colsOk) return
  await ensurePedidoMarketplaceTables()
  await prisma.$executeRawUnsafe(`ALTER TABLE "PedidoMarketplaceItem" ADD COLUMN IF NOT EXISTS "saleFee" NUMERIC`)
  colsOk = true
}

export interface ResultadoSyncML { ok: boolean; motivo?: string; encontrados: number; importados: number }

export async function sincronizarPedidosML(workspaceId: string, opts: { limite?: number } = {}): Promise<ResultadoSyncML> {
  await ensureMLPedidoCols()
  const token = await getAccessTokenValido(workspaceId)
  if (!token) return { ok: false, motivo: 'Conta do Mercado Livre não conectada.', encontrados: 0, importados: 0 }

  const [conx] = await prisma.$queryRaw`SELECT "sellerId" FROM "MLConexao" WHERE "workspaceId" = ${workspaceId}` as { sellerId: string | null }[]
  const sellerId = conx?.sellerId
  if (!sellerId) return { ok: false, motivo: 'Conta sem seller_id — reconecte.', encontrados: 0, importados: 0 }

  const limite = Math.min(Math.max(Number(opts.limite) || 50, 1), 200)
  let pedidos: any[] = []
  try {
    const url = `https://api.mercadolibre.com/orders/search?seller=${encodeURIComponent(sellerId)}&sort=date_desc&limit=${limite}`
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 15000)
    const r = await fetch(url, { signal: ctrl.signal, headers: { authorization: `Bearer ${token}` } })
    clearTimeout(t)
    if (!r.ok) return { ok: false, motivo: `ML respondeu ${r.status}.`, encontrados: 0, importados: 0 }
    const j: any = await r.json()
    pedidos = Array.isArray(j?.results) ? j.results : []
  } catch {
    return { ok: false, motivo: 'Erro ao consultar pedidos no ML.', encontrados: 0, importados: 0 }
  }

  let importados = 0
  for (const o of pedidos) {
    try {
      await gravarPedidoML(workspaceId, o)
      importados++
    } catch (e) { console.error('[ML][sync pedido]', String(e).slice(0, 200)) }
  }
  return { ok: true, encontrados: pedidos.length, importados }
}

// Mapeia 1 pedido do ML e faz upsert idempotente. Exportada para teste com payload mock.
export async function gravarPedidoML(workspaceId: string, o: any): Promise<void> {
  await ensureMLPedidoCols()
  const idExterno = String(o.id)
  const itens = Array.isArray(o.order_items) ? o.order_items : []
  const saleFeeTotal = r2(itens.reduce((s: number, it: any) => s + (Number(it.sale_fee) || 0), 0))
  const valorTotal = r2(Number(o.total_amount) || itens.reduce((s: number, it: any) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1), 0))
  const liquido = r2(valorTotal - saleFeeTotal)
  const dataPg = o.date_closed || o.date_created || null

  const rows = await prisma.$queryRaw`
    INSERT INTO "PedidoMarketplace" (
      "id","workspaceId","orderId","canal","idExterno","statusExterno",
      "dataCriacaoExterna","dataPagamento","valorTotal","totalGlobal",
      "comissaoLiquida","liquidoEstimado","destinatarioNome","createdAt","updatedAt"
    ) VALUES (
      ${gerarId()}, ${workspaceId}, ${null}, 'mercadolivre', ${idExterno}, ${o.status ?? null},
      ${o.date_created ? new Date(o.date_created) : null}, ${dataPg ? new Date(dataPg) : null},
      ${valorTotal}, ${valorTotal}, ${saleFeeTotal}, ${liquido},
      ${o.buyer?.nickname ?? null}, NOW(), NOW()
    )
    ON CONFLICT ("workspaceId","canal","idExterno") DO UPDATE SET
      "statusExterno"    = EXCLUDED."statusExterno",
      "dataPagamento"    = EXCLUDED."dataPagamento",
      "valorTotal"       = EXCLUDED."valorTotal",
      "totalGlobal"      = EXCLUDED."totalGlobal",
      "comissaoLiquida"  = EXCLUDED."comissaoLiquida",
      "liquidoEstimado"  = EXCLUDED."liquidoEstimado",
      "updatedAt"        = NOW()
    RETURNING "id"
  ` as { id: string }[]
  const pmId = rows[0]?.id
  if (!pmId) return

  // Itens: substitui a lista (idempotente), com a sale_fee real por item.
  await prisma.$executeRaw`DELETE FROM "PedidoMarketplaceItem" WHERE "pedidoMarketplaceId" = ${pmId} AND "workspaceId" = ${workspaceId}`
  for (const it of itens) {
    const qtd = Math.max(1, Math.round(Number(it.quantity) || 1))
    const preco = Number(it.unit_price) || 0
    await prisma.$executeRaw`
      INSERT INTO "PedidoMarketplaceItem" (
        "id","pedidoMarketplaceId","workspaceId","produto","sku","variacao",
        "qtd","precoAcordado","subtotal","saleFee"
      ) VALUES (
        ${gerarId()}, ${pmId}, ${workspaceId}, ${it.item?.title ?? null}, ${it.item?.seller_sku ?? null}, ${it.item?.variation_id != null ? String(it.item.variation_id) : null},
        ${qtd}, ${preco}, ${r2(preco * qtd)}, ${Number(it.sale_fee) || 0}
      )
    `
  }
}
