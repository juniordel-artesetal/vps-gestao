// Write-back SOA → TikTok: quando a EXPEDIÇÃO conclui um pedido de origem TikTok, empurra o
// fulfillment (ship/package) → o pedido no TikTok vai para AWAITING_COLLECTION (aguardando coleta).
// A transição "coletado → enviado" volta pelo SYNC do pedido (statusExterno), mostrada em Entregas.
//
// 🔒 CRÍTICO: a falha no TikTok NUNCA trava a expedição do SOA. O disparo é FAIL-OPEN: marca o
// pedido como 'pendente' e um cron reenvia. Idempotente: fulfillment já 'ok' não reenvia.
//
// Na loja de dev (11/09) o ship sem corpo voltou "missing required parameters" → agora manda
// handover_method. Pedido CANCELADO no TikTok sai da fila (status 'cancelado') em vez de retentar
// para sempre; pedido já enviado por fora conta como ok.
//
// 🧾 BR (05/10): o TikTok exige a NF-e no pedido ANTES do envio ("Need invoice uploaded for all
// order before rts"). Antes do ship: se o pedido pede nota (need_upload_invoice = NEED_INVOICE) e a
// artesã anexou o XML no SOA, sobe a nota (Upload Invoice 202502) e só então tenta o ship. Sem XML →
// 'falta_nf' (sai da fila do cron; volta quando o XML for anexado). A validação na SEFAZ é
// assíncrona: o webhook 36 grava o resultado e, se SUCCESS, dispara o envio de novo.
import { prisma } from '@/lib/prisma'
import { getAccessTokenValido, shopCipherDe, assinarRequisicao, credenciaisConfiguradas } from '@/lib/tiktok/conta'
import { TIKTOK_ENDPOINTS } from '@/lib/tiktok/config'
import { garantirColuna } from '@/lib/ddlGuard'
import { exigeNfe, nfeJaNoTikTok, motivoNfeInvalida } from '@/lib/tiktok/nfe'

const CANAL = 'tiktokshop'

let colsOk = false
async function ensureCols(): Promise<void> {
  if (colsOk) return
  // Pré-checagem no catálogo (garantirColuna): o caminho comum não pega lock de escrita na tabela.
  for (const [c, t] of [['fulfillmentStatus', 'TEXT'], ['fulfillmentPacoteId', 'TEXT'], ['fulfillmentErro', 'TEXT'],
    ['nfeExigida', 'TEXT'], ['nfeXml', 'TEXT'], ['nfeChave', 'TEXT'], ['nfeStatus', 'TEXT'], ['nfeErro', 'TEXT'], ['nfeEnviadaEm', 'TIMESTAMPTZ']])
    await garantirColuna('PedidoMarketplace', c, t)
  colsOk = true
}

interface PMRow {
  id: string; idExterno: string; rastreio: string | null; fulfillmentStatus: string | null
  nfeXml: string | null; nfeStatus: string | null
}
const COLS_PM = `"id", "idExterno", (to_jsonb(p) ->> 'rastreio') AS "rastreio", "fulfillmentStatus", "nfeXml", "nfeStatus"`

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

const MSG_FALTA_NF = 'Falta a NF-e deste pedido — o TikTok exige a nota antes do envio. Anexe o XML aqui no pedido (ou emita pelo Seller Center do TikTok).'

async function gravarNfe(pmId: string, campos: { status: string | null; erro: string | null }): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "PedidoMarketplace" SET "nfeStatus" = ${campos.status}, "nfeErro" = ${campos.erro},
      "nfeEnviadaEm" = CASE WHEN ${campos.status} = 'PROCESSING' THEN NOW() ELSE "nfeEnviadaEm" END, "updatedAt" = NOW()
    WHERE "id" = ${pmId}
  `
}

/** Sobe o XML da NF-e no pacote (Upload Invoice 202502). Nota repetida (10007014) conta como enviada. */
async function subirNfe(workspaceId: string, pm: PMRow, pacoteId: string): Promise<{ ok: boolean; msg?: string }> {
  const r = await chamar(workspaceId, 'POST', '/fulfillment/202502/invoice/upload', {
    invoices: [{ package_id: String(pacoteId), order_ids: [pm.idExterno], file_type: 'XML', file: Buffer.from(pm.nfeXml || '', 'utf8').toString('base64') }],
  })
  if (!r.ok) return { ok: false, msg: r.msg }
  const erros: { code?: number; message?: string }[] = r.data?.errors ?? []
  const real = erros.find(e => e.code !== 10007014)
  return real ? { ok: false, msg: real.message || `código ${real.code}` } : { ok: true }
}

// Executa o ship do pacote no TikTok. Retorna ok + pacoteId/rastreio, ou 'fim' quando sai da fila.
async function enviarFulfillment(workspaceId: string, pm: PMRow): Promise<{ ok: boolean; msg?: string; pacoteId?: string; rastreio?: string; fim?: 'cancelado' | 'falta_nf' }> {
  // 1) descobrir o pacote do pedido — vem do DETALHE do pedido (não há GET .../packages).
  const det = await chamar(workspaceId, 'GET', '/order/202309/orders', undefined, { ids: pm.idExterno })
  if (!det.ok) return { ok: false, msg: det.msg }
  const pedido = det.data?.orders?.[0]
  const st = String(pedido?.status ?? '').toUpperCase()
  // Só faz sentido "enviar" pedido aguardando envio. Cancelado/já enviado não é erro: encerra a fila.
  if (/CANCEL/.test(st)) return { ok: false, msg: 'CANCELADO', fim: 'cancelado' }
  if (/AWAITING_COLLECTION|IN_TRANSIT|DELIVERED|COMPLETED/.test(st)) return { ok: true, pacoteId: pedido?.packages?.[0]?.id }
  // ON_HOLD (janela de cancelamento do comprador) / UNPAID: o TikTok ainda não gerou o pacote.
  // Fica na fila; o sync dispara de novo assim que o pedido vira AWAITING_SHIPMENT.
  if (/ON_HOLD|UNPAID/.test(st)) return { ok: false, msg: `TikTok ainda está com o pedido ${st === 'UNPAID' ? 'aguardando pagamento' : 'em espera (ON_HOLD)'} — o aviso sai sozinho quando liberar para envio` }
  const pacoteId = pedido?.packages?.[0]?.id
  if (!pacoteId) return { ok: false, msg: 'pedido sem pacote (aguardando o TikTok gerar o pacote?)' }

  // 2) NF-e (só BR): o TikTok recusa o ship sem a nota no pedido.
  const necessidade = pedido?.need_upload_invoice
  await prisma.$executeRaw`UPDATE "PedidoMarketplace" SET "nfeExigida" = ${necessidade ?? null} WHERE "id" = ${pm.id}`
  if (nfeJaNoTikTok(necessidade) && pm.nfeStatus !== 'SUCCESS' && pm.nfeXml) await gravarNfe(pm.id, { status: 'SUCCESS', erro: null })
  if (exigeNfe(necessidade)) {
    if (!pm.nfeXml) return { ok: false, msg: MSG_FALTA_NF, fim: 'falta_nf' }
    if (pm.nfeStatus === 'INVALID' || pm.nfeStatus === 'FAILED') return { ok: false, msg: 'O TikTok recusou a NF-e anexada — anexe o XML corrigido.', fim: 'falta_nf' }
    if (pm.nfeStatus !== 'PROCESSING') {
      const up = await subirNfe(workspaceId, pm, String(pacoteId))
      if (!up.ok) {
        await gravarNfe(pm.id, { status: 'FAILED', erro: `TikTok recusou a NF-e: ${up.msg}`.slice(0, 300) })
        return { ok: false, msg: `TikTok recusou a NF-e: ${up.msg}`, fim: 'falta_nf' }
      }
      await gravarNfe(pm.id, { status: 'PROCESSING', erro: null })
    }
    // Validação na SEFAZ é assíncrona; tenta o ship já (se ainda não validou, fica na fila e o
    // webhook 36 / próximo sync disparam de novo).
  }

  // 3) Ship Package (202309): envio pela logística do TikTok exige handover_method — sem ele a API
  //    devolve "missing one or more required parameters". DROP_OFF = a artesã leva ao ponto de
  //    postagem (não exige janela de coleta). Rastreio próprio exigiria shipping_provider_id.
  const ship = await chamar(workspaceId, 'POST', `/fulfillment/202309/packages/${encodeURIComponent(pacoteId)}/ship`, { handover_method: 'DROP_OFF' })
  if (!ship.ok) {
    if (/invoice/i.test(ship.msg || '')) {
      return exigeNfe(necessidade) && pm.nfeXml
        ? { ok: false, msg: 'NF-e enviada ao TikTok — aguardando a validação na SEFAZ; o aviso de envio sai em seguida.' }
        : { ok: false, msg: MSG_FALTA_NF, fim: 'falta_nf' }
    }
    return { ok: false, msg: ship.msg }
  }
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

async function aplicarResultado(pm: PMRow, workspaceId: string, r: Awaited<ReturnType<typeof enviarFulfillment>>): Promise<void> {
  // Sucesso → TikTok agora está AGUARDANDO COLETA (acende o alerta no SOA até a coleta).
  if (r.ok) await gravar(pm.id, workspaceId, { status: 'aguardando_coleta', pacoteId: r.pacoteId ?? null, erro: null, rastreio: r.rastreio ?? null })
  else if (r.fim === 'cancelado') await gravar(pm.id, workspaceId, { status: 'cancelado', erro: null })
  else if (r.fim === 'falta_nf') await gravar(pm.id, workspaceId, { status: 'falta_nf', erro: (r.msg ?? '').slice(0, 300) })
  else await gravar(pm.id, workspaceId, { status: 'pendente', erro: (r.msg ?? 'erro').slice(0, 300) })
}

/**
 * Ponto de entrada chamado no hook de expedição (fail-open). Só age em pedido de origem TikTok
 * conectada. Idempotente: 'ok' não reenvia. Nunca lança — a expedição do SOA segue de qualquer jeito.
 */
export async function dispararFulfillmentTikTok(workspaceId: string, orderId: string): Promise<void> {
  try {
    await ensureCols()
    const [pm] = await prisma.$queryRawUnsafe(
      `SELECT ${COLS_PM} FROM "PedidoMarketplace" p WHERE "workspaceId" = $1 AND "orderId" = $2 AND "canal" = $3 LIMIT 1`,
      workspaceId, orderId, CANAL,
    ) as PMRow[]
    if (!pm) return // não é pedido TikTok sincronizado
    if (pm.fulfillmentStatus === 'aguardando_coleta') return // já avisado ao TikTok (idempotente)

    // Marca como pendente ANTES de tentar — se a tentativa falhar/estourar, fica na fila do cron.
    await gravar(pm.id, workspaceId, { status: 'pendente', erro: null })
    await aplicarResultado(pm, workspaceId, await enviarFulfillment(workspaceId, pm))
  } catch (e) {
    // FAIL-OPEN absoluto: nunca propaga para a expedição.
    console.error('[TIKTOK][fulfillment] disparo falhou (não trava expedição):', (e as Error)?.message)
  }
}

/**
 * Webhook 36 (Invoice status change): grava o resultado da validação da NF-e nos pedidos do evento.
 * SUCCESS → dispara o envio de novo (o ship agora passa). INVALID/FAILED → motivo em português.
 */
export async function registrarStatusNfe(workspaceId: string, orderIds: string[], status: string, motivo?: string | null): Promise<void> {
  await ensureCols()
  const st = String(status || '').toUpperCase()
  const erro = st === 'INVALID' || st === 'FAILED' ? `TikTok recusou a NF-e: ${motivoNfeInvalida(motivo)}` : null
  for (const idExterno of orderIds) {
    const [pm] = await prisma.$queryRaw`
      SELECT "id", "orderId" FROM "PedidoMarketplace" WHERE "workspaceId" = ${workspaceId} AND "canal" = ${CANAL} AND "idExterno" = ${idExterno} LIMIT 1
    ` as { id: string; orderId: string | null }[]
    if (!pm) continue
    await gravarNfe(pm.id, { status: st || null, erro })
    if (erro) await gravar(pm.id, workspaceId, { status: 'falta_nf', erro })
    // Nota validada e pedido já expedido no SOA → avisa o envio agora.
    if (st === 'SUCCESS' && pm.orderId) {
      const [o] = await prisma.$queryRaw`SELECT "status" FROM "Order" WHERE "id" = ${pm.orderId} AND "workspaceId" = ${workspaceId} LIMIT 1` as { status: string }[]
      if (o?.status === 'ENVIADO') await dispararFulfillmentTikTok(workspaceId, pm.orderId)
    }
  }
}

/** Cron: reenvia os fulfillments 'pendente' (que falharam no disparo). Idempotente, fail-open. */
export async function retentarFulfillmentsPendentes(limite = 50): Promise<{ tentados: number; ok: number; falhas: number }> {
  await ensureCols()
  const pend = await prisma.$queryRawUnsafe(
    `SELECT ${COLS_PM}, "workspaceId" FROM "PedidoMarketplace" p WHERE "canal" = $1 AND "fulfillmentStatus" = 'pendente' ORDER BY "updatedAt" ASC LIMIT ${Math.max(1, Math.min(200, Math.floor(limite)))}`,
    CANAL,
  ) as (PMRow & { workspaceId: string })[]
  let ok = 0, falhas = 0
  for (const pm of pend) {
    try {
      const r = await enviarFulfillment(pm.workspaceId, pm)
      await aplicarResultado(pm, pm.workspaceId, r)
      if (r.ok) ok++; else if (!r.fim) falhas++
    } catch (e) { falhas++; console.error('[TIKTOK][fulfillment] retry falhou:', (e as Error)?.message) }
  }
  return { tentados: pend.length, ok, falhas }
}
