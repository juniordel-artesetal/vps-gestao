// Write-back SOA → TikTok: quando a EXPEDIÇÃO conclui um pedido de origem TikTok, empurra o
// fulfillment (ship/package) → o pedido no TikTok vai para AWAITING_COLLECTION (aguardando coleta).
// A transição "coletado → enviado" volta pelo SYNC do pedido (statusExterno), mostrada em Entregas.
//
// 🔒 CRÍTICO: a falha no TikTok NUNCA trava a expedição do SOA. O disparo é FAIL-OPEN: marca o
// pedido como 'pendente' e um cron reenvia. Idempotente: fulfillment já 'ok' não reenvia.
//
// ⚠️ As chamadas de ESCRITA (fulfillment 202309) NÃO foram exercitadas contra a API real — os
// payloads seguem a doc e DEVEM ser validados na LOJA DE DEV; até lá, cada tentativa que falha
// fica em 'pendente' (sem travar nada) e o cron retenta.
import { prisma } from '@/lib/prisma'
import { getAccessTokenValido, shopCipherDe, assinarRequisicao, credenciaisConfiguradas } from '@/lib/tiktok/conta'
import { TIKTOK_ENDPOINTS } from '@/lib/tiktok/config'

const CANAL = 'tiktokshop'

let colsOk = false
async function ensureCols(): Promise<void> {
  if (colsOk) return
  await prisma.$executeRawUnsafe(`ALTER TABLE "PedidoMarketplace" ADD COLUMN IF NOT EXISTS "fulfillmentStatus" TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PedidoMarketplace" ADD COLUMN IF NOT EXISTS "fulfillmentPacoteId" TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PedidoMarketplace" ADD COLUMN IF NOT EXISTS "fulfillmentErro" TEXT`)
  colsOk = true
}

interface PMRow { id: string; idExterno: string; rastreio: string | null; fulfillmentStatus: string | null }

// Chamada assinada ao open-api (com shop_cipher + token). Reaproveita a assinatura da conta.
async function chamar(workspaceId: string, metodo: 'GET' | 'POST', path: string, corpo?: unknown, extra?: Record<string, string>): Promise<{ ok: boolean; msg?: string; data?: any }> {
  if (!credenciaisConfiguradas()) return { ok: false, msg: 'sem credenciais' }
  const token = await getAccessTokenValido(workspaceId)
  const cipher = await shopCipherDe(workspaceId)
  if (!token || !cipher) return { ok: false, msg: 'loja não conectada' }
  // Query params (ids, etc.) vão AQUI (assinados + na URL). Nunca concatenar no path.
  const params: Record<string, string> = {
    ...(extra ?? {}),
    app_key: process.env.TIKTOK_APP_KEY || '',
    timestamp: String(Math.floor(Date.now() / 1000)),
    shop_cipher: cipher,
  }
  const body = corpo === undefined ? undefined : JSON.stringify(corpo)
  params.sign = assinarRequisicao(path, params, body)
  const url = `${TIKTOK_ENDPOINTS.apiBase}${path}?${new URLSearchParams(params).toString()}`
  try {
    const r = await fetch(url, { method: metodo, body, headers: { 'content-type': 'application/json', 'x-tts-access-token': token }, signal: AbortSignal.timeout(20000) })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok || j?.code !== 0) return { ok: false, msg: j?.message || `HTTP ${r.status}` }
    return { ok: true, data: j?.data }
  } catch (e) {
    return { ok: false, msg: (e as Error)?.name === 'TimeoutError' ? 'timeout' : 'falha de conexão' }
  }
}

// Executa o ship do pacote no TikTok. ⚠️ Payload a validar no sandbox. Retorna ok + pacoteId/rastreio.
async function enviarFulfillment(workspaceId: string, pm: PMRow): Promise<{ ok: boolean; msg?: string; pacoteId?: string; rastreio?: string }> {
  // 1) descobrir o pacote do pedido — vem do DETALHE do pedido (não há GET .../packages).
  //    ⚠️ Caminho a confirmar com um pedido de teste real na loja de dev.
  const det = await chamar(workspaceId, 'GET', '/order/202309/orders', undefined, { ids: pm.idExterno })
  if (!det.ok) return { ok: false, msg: det.msg }
  const pacoteId = det.data?.orders?.[0]?.packages?.[0]?.id
  if (!pacoteId) return { ok: false, msg: 'pedido sem pacote (aguardando o TikTok gerar o pacote?)' }

  // 2) marcar como enviado/pronto para coleta. Se houver rastreio próprio, informa; senão usa a
  //    logística do TikTok (self_shipment vs platform). ⚠️ Conferir o corpo exato na loja de dev.
  const corpo: any = pm.rastreio ? { tracking_number: pm.rastreio } : {}
  const ship = await chamar(workspaceId, 'POST', `/fulfillment/202309/packages/${encodeURIComponent(pacoteId)}/ship`, corpo)
  if (!ship.ok) return { ok: false, msg: ship.msg }
  return { ok: true, pacoteId: String(pacoteId), rastreio: ship.data?.tracking_number ?? pm.rastreio ?? undefined }
}

/** Grava o resultado do fulfillment no pedido (aditivo). */
async function gravar(pmId: string, workspaceId: string, campos: { status: string; pacoteId?: string | null; erro?: string | null; rastreio?: string | null }): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "PedidoMarketplace"
    SET "fulfillmentStatus" = ${campos.status},
        "fulfillmentPacoteId" = COALESCE(${campos.pacoteId ?? null}, "fulfillmentPacoteId"),
        "fulfillmentErro" = ${campos.erro ?? null},
        "rastreio" = COALESCE(${campos.rastreio ?? null}, "rastreio"),
        "updatedAt" = NOW()
    WHERE "id" = ${pmId} AND "workspaceId" = ${workspaceId}
  `
}

/**
 * Ponto de entrada chamado no hook de expedição (fail-open). Só age em pedido de origem TikTok
 * conectada. Idempotente: 'ok' não reenvia. Nunca lança — a expedição do SOA segue de qualquer jeito.
 */
export async function dispararFulfillmentTikTok(workspaceId: string, orderId: string): Promise<void> {
  try {
    await ensureCols()
    const [pm] = await prisma.$queryRaw`
      SELECT "id", "idExterno", (to_jsonb(p) ->> 'rastreio') AS "rastreio", "fulfillmentStatus"
      FROM "PedidoMarketplace" p
      WHERE "workspaceId" = ${workspaceId} AND "orderId" = ${orderId} AND "canal" = ${CANAL} LIMIT 1
    ` as PMRow[]
    if (!pm) return // não é pedido TikTok sincronizado
    if (pm.fulfillmentStatus === 'ok') return // já enviado (idempotente)

    // Marca como pendente ANTES de tentar — se a tentativa falhar/estourar, fica na fila do cron.
    await gravar(pm.id, workspaceId, { status: 'pendente', erro: null })
    const r = await enviarFulfillment(workspaceId, pm)
    if (r.ok) await gravar(pm.id, workspaceId, { status: 'ok', pacoteId: r.pacoteId ?? null, erro: null, rastreio: r.rastreio ?? null })
    else await gravar(pm.id, workspaceId, { status: 'pendente', erro: (r.msg ?? 'erro').slice(0, 300) })
  } catch (e) {
    // FAIL-OPEN absoluto: nunca propaga para a expedição.
    console.error('[TIKTOK][fulfillment] disparo falhou (não trava expedição):', (e as Error)?.message)
  }
}

/** Cron: reenvia os fulfillments 'pendente' (que falharam no disparo). Idempotente, fail-open. */
export async function retentarFulfillmentsPendentes(limite = 50): Promise<{ tentados: number; ok: number; falhas: number }> {
  await ensureCols()
  const pend = await prisma.$queryRaw`
    SELECT "id", "workspaceId", "idExterno", (to_jsonb(p) ->> 'rastreio') AS "rastreio", "fulfillmentStatus"
    FROM "PedidoMarketplace" p
    WHERE "canal" = ${CANAL} AND "fulfillmentStatus" = 'pendente'
    ORDER BY "updatedAt" ASC LIMIT ${limite}
  ` as (PMRow & { workspaceId: string })[]
  let ok = 0, falhas = 0
  for (const pm of pend) {
    try {
      const r = await enviarFulfillment(pm.workspaceId, pm)
      if (r.ok) { await gravar(pm.id, pm.workspaceId, { status: 'ok', pacoteId: r.pacoteId ?? null, erro: null, rastreio: r.rastreio ?? null }); ok++ }
      else { await gravar(pm.id, pm.workspaceId, { status: 'pendente', erro: (r.msg ?? 'erro').slice(0, 300) }); falhas++ }
    } catch (e) { falhas++; console.error('[TIKTOK][fulfillment] retry falhou:', (e as Error)?.message) }
  }
  return { tentados: pend.length, ok, falhas }
}
