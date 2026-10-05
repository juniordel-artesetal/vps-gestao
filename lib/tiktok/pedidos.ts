// Sync SÓ-LEITURA de pedidos do TikTok Shop → PedidoMarketplace/PedidoMarketplaceItem
// (canal 'tiktokshop'). Idempotente por (workspaceId,'tiktokshop',idExterno). Quando o
// canal está ativo em MarketplaceConfig, também cria o Order + Recebível (mesmo caminho
// da Shopee/ML) respeitando o opt-in financeiro. Sem conexão → não faz nada (fallback).
//
// ⚠️ O mapeamento dos campos do pedido segue a doc do TikTok Shop (Order API 202309);
// como não dá para exercitar a API real aqui, o parsing é DEFENSIVO (optional chaining
// + fallbacks) e deve ser conferido contra a loja de teste na 1ª sincronização real.
import { prisma } from '@/lib/prisma'
import { getAccessTokenValido, shopCipherDe, assinarRequisicao, credenciaisConfiguradas, marcarSync } from '@/lib/tiktok/conta'
import { TIKTOK_ENDPOINTS } from '@/lib/tiktok/config'
import { ensurePedidoMarketplaceTables } from '@/app/api/importacao/pedidos/_lib/schema'
import { criarRecebivelPedidoSincronizado, definirEstadoRecebivelMarketplace } from '@/lib/marketplace/recebivelFluxo'
import { garantirClienteCrm } from '@/lib/clienteCrm'
import { dadosComprador, ROTULO_COMPRADOR } from '@/lib/tiktok/comprador'
import { dispararFulfillmentTikTok } from '@/lib/tiktok/fulfillment'

/**
 * Cliente do pedido TikTok sem duplicar: o e-mail do comprador (relay do TikTok, estável por
 * comprador) é o identificador; sem ele, cai no match por nome do CRM. Comprador anônimo/mascarado
 * ganha "Cliente TikTok ####" (final do id do comprador) para não fundir compradores diferentes.
 */
async function clienteDoComprador(workspaceId: string, c: ReturnType<typeof dadosComprador>): Promise<string | null> {
  if (c.email) {
    const [x] = await prisma.$queryRaw`
      SELECT "id" FROM "Cliente" WHERE "workspaceId" = ${workspaceId} AND "ativo" = true AND LOWER("email") = ${c.email} LIMIT 1
    ` as { id: string }[]
    if (x) return x.id
  }
  const sufixo = (c.buyerId || c.email?.split('@')[0] || '').slice(-4)
  const nome = c.nomeReal ? c.nome : `${ROTULO_COMPRADOR}${sufixo ? ' ' + sufixo : ''}`
  return garantirClienteCrm(workspaceId, { nome, telefone: c.telefone, email: c.email, origem: 'tiktok' })
}

const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const r2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
const CANAL_SLUG = 'tiktokshop'
const CANAL_LABEL = 'TikTok Shop'

let colsOk = false
async function ensureCols(): Promise<void> {
  if (colsOk) return
  await ensurePedidoMarketplaceTables()
  await prisma.$executeRawUnsafe(`ALTER TABLE "PedidoMarketplaceItem" ADD COLUMN IF NOT EXISTS "saleFee" NUMERIC`)
  // Rastreio (aditivo) — alimenta o submenu Entregas. Preenchido quando o payload traz.
  await prisma.$executeRawUnsafe(`ALTER TABLE "PedidoMarketplace" ADD COLUMN IF NOT EXISTS "rastreio" TEXT`)
  colsOk = true
}

// Extrai o código de rastreio do payload do pedido (formatos variam por versão da API).
function extrairRastreio(o: any): string | null {
  return o?.tracking_number
    ?? o?.packages?.[0]?.tracking_number
    ?? o?.package_list?.[0]?.tracking_number
    ?? null
}

function paraDataSeg(v: any): Date | null {
  const n = Number(v) || 0
  if (n <= 0) return null
  return new Date(n > 1_000_000_000_000 ? n : n * 1000) // aceita ms ou s
}

/**
 * Itens do pedido no formato do SOA (camposExtras.produtos) — é por eles que a expedição dá baixa
 * no Estoque de Produtos. O seller_sku do TikTok aponta para a VARIAÇÃO do SOA (mapa gravado na
 * publicação, camposMarketplace.skusTikTok); sem mapa, cai no nome do produto/SKU do TikTok.
 */
type ItemTT = { seller_sku?: string | null; product_name?: string | null; sku_name?: string | null; quantity?: number | string | null }
export async function produtosDoPedidoTikTok(workspaceId: string, itens: ItemTT[]): Promise<{ nome: string; quantidade: number }[]> {
  const skus = [...new Set(itens.map(it => String(it?.seller_sku ?? '').trim()).filter(Boolean))]
  const porSku = new Map<string, string>()
  if (skus.length) {
    const rows = await prisma.$queryRaw`
      SELECT m.key AS "sku", TRIM(p."nome" || ' ' || COALESCE(v."nome", '')) AS "nome"
      FROM "PrecProduto" p
      CROSS JOIN LATERAL jsonb_each_text(COALESCE(p."camposMarketplace" -> 'skusTikTok', '{}'::jsonb)) m
      JOIN "PrecVariacao" v ON v."id" = m.value AND v."produtoId" = p."id"
      WHERE p."workspaceId" = ${workspaceId} AND m.key = ANY(${skus}::text[])
    ` as { sku: string; nome: string }[]
    for (const r of rows) porSku.set(r.sku, r.nome)
  }
  return itens.map(it => ({
    nome: porSku.get(String(it?.seller_sku ?? '').trim()) || [it?.product_name, it?.sku_name && it.sku_name !== 'Padrão' ? it.sku_name : null].filter(Boolean).join(' ') || 'Pedido TikTok Shop',
    quantidade: Math.max(1, Math.round(Number(it?.quantity) || 1)),
  }))
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
  await marcarSync(workspaceId)
  return { ok: true, encontrados: pedidos.length, importados }
}

/**
 * Sincroniza UM pedido pelo id externo (para o webhook de mudança de status): busca o detalhe
 * e re-grava (upsert) → statusExterno atualizado + cliente/financeiro reprocessados. Idempotente.
 * ⚠️ `ids` vai como PARÂMETRO ASSINADO (nunca no path) — senão dá "?" duplo e "Invalid app_key".
 */
export async function sincronizarUmPedidoTikTok(workspaceId: string, orderIdExterno: string): Promise<{ ok: boolean; motivo?: string }> {
  await ensureCols()
  const token = await getAccessTokenValido(workspaceId)
  const cipher = await shopCipherDe(workspaceId)
  if (!token || !cipher) return { ok: false, motivo: 'loja não conectada' }
  const path = '/order/202309/orders'
  const params: Record<string, string> = {
    ids: orderIdExterno,
    app_key: process.env.TIKTOK_APP_KEY || '',
    timestamp: String(Math.floor(Date.now() / 1000)),
    shop_cipher: cipher,
  }
  params.sign = assinarRequisicao(path, params)
  try {
    const r = await fetch(`${TIKTOK_ENDPOINTS.apiBase}${path}?${new URLSearchParams(params).toString()}`, {
      headers: { 'content-type': 'application/json', 'x-tts-access-token': token }, signal: AbortSignal.timeout(15000),
    })
    const j: any = await r.json().catch(() => ({}))
    if (j?.code !== 0) return { ok: false, motivo: j?.message || `HTTP ${r.status}` }
    const o = j?.data?.orders?.[0]
    if (o) await gravarPedidoTikTok(workspaceId, o)
    return { ok: true }
  } catch { return { ok: false, motivo: 'erro de conexão' } }
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
  // Nome vazio/mascarado (sandbox) → "Cliente TikTok", nunca em branco. order_id = ID na plataforma.
  const comprador = dadosComprador(o)
  const destinatario = comprador.nome
  const qtdTotal = Math.max(1, itens.reduce((s, it) => s + (Number(it?.quantity) || 1), 0))
  const produtos = itens.map(it => it?.product_name || it?.sku_name).filter(Boolean).join(' + ') || 'Pedido TikTok Shop'

  const rastreio = extrairRastreio(o)
  // Itens no formato do SOA (camposExtras.produtos) → a expedição baixa o estoque da variação certa.
  // O TikTok manda 1 line_item por unidade: agrupa por nome somando as quantidades.
  const agrupados = new Map<string, number>()
  for (const p of await produtosDoPedidoTikTok(workspaceId, itens)) agrupados.set(p.nome, (agrupados.get(p.nome) ?? 0) + p.quantidade)
  const extras = JSON.stringify({ produtos: [...agrupados].map(([nome, quantidade]) => ({ nome, quantidade })) })
  const rows = await prisma.$queryRaw`
    INSERT INTO "PedidoMarketplace" (
      "id","workspaceId","orderId","canal","idExterno","statusExterno",
      "dataCriacaoExterna","dataPagamento","valorTotal","totalGlobal",
      "comissaoLiquida","liquidoEstimado","destinatarioNome","rastreio",
      "endereco","bairro","cidade","uf","cep","createdAt","updatedAt"
    ) VALUES (
      ${gerarId()}, ${workspaceId}, ${null}, ${CANAL_SLUG}, ${idExterno}, ${status},
      ${dataCriacao}, ${dataPagamento}, ${valorTotal}, ${valorTotal},
      ${null}, ${valorTotal}, ${destinatario}, ${rastreio},
      ${comprador.rua}, ${comprador.bairro}, ${comprador.cidade}, ${comprador.uf}, ${comprador.cep}, NOW(), NOW()
    )
    ON CONFLICT ("workspaceId","canal","idExterno") DO UPDATE SET
      "statusExterno"   = EXCLUDED."statusExterno",
      "dataPagamento"   = EXCLUDED."dataPagamento",
      "valorTotal"      = EXCLUDED."valorTotal",
      "totalGlobal"     = EXCLUDED."totalGlobal",
      "liquidoEstimado" = EXCLUDED."liquidoEstimado",
      "rastreio"        = COALESCE(EXCLUDED."rastreio", "PedidoMarketplace"."rastreio"),
      "destinatarioNome" = CASE WHEN COALESCE("PedidoMarketplace"."destinatarioNome", '') IN ('', ${ROTULO_COMPRADOR}) THEN EXCLUDED."destinatarioNome" ELSE "PedidoMarketplace"."destinatarioNome" END,
      "endereco"        = COALESCE(EXCLUDED."endereco", "PedidoMarketplace"."endereco"),
      "bairro"          = COALESCE(EXCLUDED."bairro", "PedidoMarketplace"."bairro"),
      "cidade"          = COALESCE(EXCLUDED."cidade", "PedidoMarketplace"."cidade"),
      "uf"              = COALESCE(EXCLUDED."uf", "PedidoMarketplace"."uf"),
      "cep"             = COALESCE(EXCLUDED."cep", "PedidoMarketplace"."cep"),
      "updatedAt"       = NOW()
    RETURNING "id"
  ` as { id: string }[]
  const pmId = rows[0]?.id
  if (!pmId) return
  // BR: o pedido exige NF-e antes do envio? (need_upload_invoice) — a tela avisa a artesã ANTES de expedir.
  if (o?.need_upload_invoice != null) {
    try { await prisma.$executeRaw`UPDATE "PedidoMarketplace" SET "nfeExigida" = ${String(o.need_upload_invoice)} WHERE "id" = ${pmId}` } catch { /* coluna nova (migrar-tiktok-nfe) */ }
  }

  // ── Item A: TODO pedido sincronizado entra na LISTA DE PEDIDOS (canal TikTok Shop) ──
  // Não depende mais de MarketplaceConfig ativo: quem conectou a loja quer os pedidos no
  // SOA. O opt-in por canal fica só para o FINANCEIRO (recebível) abaixo. Find-or-create
  // por (workspaceId, numero) — (numero) tem índice mas NÃO é único, então nada de ON CONFLICT.
  const numero = `TT-${idExterno}`
  const [ja] = await prisma.$queryRaw`
    SELECT "id" FROM "Order" WHERE "workspaceId" = ${workspaceId} AND "numero" = ${numero} LIMIT 1
  ` as { id: string }[]
  let orderId = ja?.id
  if (orderId) {
    await prisma.$executeRaw`
      UPDATE "Order" SET "valor" = ${valorTotal}, "camposExtras" = COALESCE("camposExtras", ${extras}),
        -- completa o que veio vazio (sem sobrescrever o que a artesã editou)
        "destinatario" = CASE WHEN COALESCE(TRIM("destinatario"), '') IN ('', 'Comprador TikTok Shop', ${ROTULO_COMPRADOR}) THEN ${destinatario} ELSE "destinatario" END,
        "idCliente" = COALESCE(NULLIF("idCliente", ''), ${idExterno}),
        "endereco" = COALESCE(NULLIF("endereco", ''), ${comprador.endereco}),
        "updatedAt" = NOW()
      WHERE "id" = ${orderId} AND "workspaceId" = ${workspaceId}
    `
  } else {
    orderId = gerarId()
    await prisma.$executeRaw`
      INSERT INTO "Order"
        ("id","workspaceId","numero","destinatario","idCliente","endereco","canal","produto","quantidade","valor",
         "prioridade","status","dataEntrada","camposExtras","createdAt","updatedAt")
      VALUES
        (${orderId}, ${workspaceId}, ${numero}, ${destinatario}, ${idExterno}, ${comprador.endereco},
         ${CANAL_LABEL}, ${produtos}, ${qtdTotal}, ${valorTotal},
         'NORMAL', 'ABERTO', ${dataCriacao ?? new Date()}, ${extras}, NOW(), NOW())
    `
  }
  if (orderId) {
    await prisma.$executeRaw`UPDATE "PedidoMarketplace" SET "orderId" = ${orderId}, "updatedAt" = NOW() WHERE "id" = ${pmId}`
    // Item F (financeiro) é OPT-IN: criarRecebivelSeCanalAtivo só cria a previsão se o canal
    // estiver ATIVO em MarketplaceConfig e o marketplaceLancaFinanceiro ligado.
    await criarRecebivelPedidoSincronizado(workspaceId, orderId, CANAL_LABEL, valorTotal)

    // Item B — Cliente automático (dedupe; só se o módulo Clientes estiver on). Vincula ao pedido.
    const clienteId = await clienteDoComprador(workspaceId, comprador)
    if (clienteId) {
      await prisma.$executeRaw`UPDATE "Order" SET "clienteId" = ${clienteId}, "updatedAt" = NOW() WHERE "id" = ${orderId} AND "workspaceId" = ${workspaceId}`
    }

    // Item F — estado do recebível conforme o status do TikTok (previsto → recebido → estorno).
    const st = String(status || '').toUpperCase()
    const estado: 'aguardando_envio' | 'previsto' | 'recebido' | 'cancelado' =
      /CANCEL|REFUND/.test(st) ? 'cancelado'
      : /DELIVER|COMPLET/.test(st) ? 'recebido'
      : /UNPAID|ON_HOLD|AWAITING_PAYMENT/.test(st) ? 'aguardando_envio'
      : 'previsto'
    // O SOA é quem EXPEDE: pedido já ENVIADO aqui não volta a "aguardando envio" só porque o
    // TikTok ainda está em ON_HOLD (antes o sync de 2 em 2 min desfazia o previsto da expedição).
    const [ped] = await prisma.$queryRaw`SELECT "status" FROM "Order" WHERE "id" = ${orderId} AND "workspaceId" = ${workspaceId} LIMIT 1` as { status: string }[]
    const expedidoNoSoa = ped?.status === 'ENVIADO'
    if (!(expedidoNoSoa && estado === 'aguardando_envio')) {
      await definirEstadoRecebivelMarketplace(workspaceId, orderId, estado, dataCriacao)
    }
    // Expedido no SOA enquanto o TikTok ainda não tinha o pacote → assim que o TikTok libera
    // (AWAITING_SHIPMENT), avisa o envio na hora (sem esperar o cron de 30 min). Idempotente.
    if (expedidoNoSoa && st === 'AWAITING_SHIPMENT') await dispararFulfillmentTikTok(workspaceId, orderId)

    // Cancelado no TikTok → cancelado no SOA, enquanto ainda não saiu da produção (pedido já
    // PRONTO/ENVIADO fica como está: a devolução/estorno de estoque é decisão da artesã).
    if (estado === 'cancelado') {
      await prisma.$executeRaw`
        UPDATE "Order" SET "status" = 'CANCELADO', "updatedAt" = NOW()
        WHERE "id" = ${orderId} AND "workspaceId" = ${workspaceId} AND "status" IN ('ABERTO','EM_PRODUCAO')
      `
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
