// Processamento dos eventos de webhook do Asaas.
//
// Vive na lib (e não na rota) porque tem DOIS chamadores:
//   1. POST /api/webhooks/asaas          — entrega ao vivo do Asaas
//   2. POST /api/config/asaas/reprocessar — eventos guardados com a flag OFF
// A regra de negócio precisa ser idêntica nos dois; duplicar seria pedir divergência.
import { prisma } from '@/lib/prisma'
import { aplicarNoAcesso } from '@/lib/assinatura/acesso'
import { concluirCheckout, encerrarCheckout } from '@/lib/assinatura/checkout'

// O mascaramento LGPD vive em ./mascarar (módulo puro, testável sem banco).
export * from './mascarar'

// ──────────────────────────────── PROCESSAMENTO ──────────────────────────────

export const STATUS_POR_EVENTO: Record<string, string> = {
  PAYMENT_RECEIVED: 'RECEIVED',
  PAYMENT_CONFIRMED: 'CONFIRMED',
  PAYMENT_OVERDUE: 'OVERDUE',
  PAYMENT_REFUNDED: 'REFUNDED',
  PAYMENT_DELETED: 'DELETED',
  PAYMENT_CHARGEBACK_REQUESTED: 'CHARGEBACK_REQUESTED',
}
const PAGOS = new Set(['RECEIVED', 'CONFIRMED'])

/** Eventos de ASSINATURA (não de cobrança) que refletimos no nosso estado. */
const EVENTOS_ASSINATURA_ENCERRA = new Set(['SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED'])

export interface PayloadAsaas {
  id?: string
  event?: string
  subscription?: {
    id?: string
    status?: string
    cycle?: string
    value?: number
    nextDueDate?: string
  }
  checkout?: {
    id?: string
    status?: string
  }
  payment?: {
    id?: string
    subscription?: string
    customer?: string
    value?: number
    netValue?: number
    status?: string
    billingType?: string
    dueDate?: string
    externalReference?: string
  }
}

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/**
 * Aplica o efeito do evento em AsaasCobranca/AsaasAssinatura.
 * Idempotente por natureza: reexecutar com o mesmo payload leva ao mesmo estado.
 * Retorna se houve efeito (evento desconhecido é ignorado sem erro).
 */
export async function aplicarEvento(body: PayloadAsaas): Promise<{ aplicado: boolean }> {
  const evento = body?.event ?? ''

  // ── PORTÃO DE ENTRADA: o checkout hospedado avisando o desfecho.
  // Sem estes eventos a conta ficaria eternamente em AGUARDANDO_PAGAMENTO mesmo
  // depois de paga — o funil inteiro depende deles.
  if (evento.startsWith('CHECKOUT_') && body.checkout?.id) {
    const id = body.checkout.id
    if (evento === 'CHECKOUT_PAID') {
      const r = await concluirCheckout(id)
      console.log(`[ASAAS-WH] checkout pago ${id} ws=${r.workspaceId ?? '?'}`)
    } else {
      // EXPIRED / CANCELED: o link morre, o estado continua aguardando. Ela pode
      // gerar outro pela tela — nada de conta perdida por causa de um link.
      await encerrarCheckout(id, evento)
    }
    return { aplicado: true }
  }

  // ── Assinatura encerrada NO ASAAS (cancelada pelo painel, por exemplo).
  // Reflete aqui para o nosso estado não dizer "ativa" enquanto lá não existe
  // mais — o que faria a régua cobrar alguém que já não tem assinatura.
  // `assinaturaExpira` é preservada: o acesso vai até o fim do ciclo pago.
  if (EVENTOS_ASSINATURA_ENCERRA.has(evento) && body.subscription?.id) {
    const sub = body.subscription.id
    await prisma.$executeRaw`
      UPDATE "AsaasAssinatura"
      SET "status" = 'CANCELADA',
          "canceladaEm" = COALESCE("canceladaEm", NOW()),
          "canceladaPor" = COALESCE("canceladaPor", 'asaas'),
          "canceladaMotivo" = COALESCE("canceladaMotivo", ${`Evento ${evento}`}),
          "updatedAt" = NOW()
      WHERE "subscriptionId" = ${sub} AND "status" <> 'CANCELADA'
    `
    await prisma.$executeRaw`
      UPDATE "Workspace" SET "assinaturaStatus" = 'CANCELADA', "updatedAt" = NOW()
      WHERE "id" = (SELECT "workspaceId" FROM "AsaasAssinatura" WHERE "subscriptionId" = ${sub})
        AND "assinaturaOrigem" = 'asaas'
    `
    console.log(`[ASAAS-WH] assinatura encerrada no Asaas sub=${sub} evento=${evento}`)
    return { aplicado: true }
  }

  const pag = body?.payment
  const novoStatus = STATUS_POR_EVENTO[evento]
  if (!novoStatus || !pag?.id) return { aplicado: false }

  const pago = PAGOS.has(novoStatus)

  // UPSERT: cobrança gerada POR ASSINATURA nasce no Asaas, não no nosso banco —
  // o webhook é a primeira vez que a vemos. Sem isto, ela nunca seria registrada.
  await prisma.$executeRaw`
    INSERT INTO "AsaasCobranca" ("id","paymentId","subscriptionId","finalidade","billingType",
                                 "valor","valorLiquido","status","vencimento","pagoEm","referencia",
                                 "createdAt","updatedAt")
    VALUES (${gerarId()}, ${pag.id}, ${pag.subscription ?? null},
            ${pag.subscription ? 'assinatura' : 'avulsa'}, ${pag.billingType ?? null},
            ${pag.value ?? 0}, ${pag.netValue ?? null}, ${novoStatus},
            ${pag.dueDate ?? null}::date, ${pago ? new Date() : null},
            ${pag.externalReference ?? null}, NOW(), NOW())
    ON CONFLICT ("paymentId") DO UPDATE SET
      "status"       = EXCLUDED."status",
      "valorLiquido" = COALESCE(EXCLUDED."valorLiquido", "AsaasCobranca"."valorLiquido"),
      -- pagoEm nunca é reescrito: preserva a data do primeiro recebimento.
      "pagoEm"       = COALESCE("AsaasCobranca"."pagoEm", EXCLUDED."pagoEm"),
      "updatedAt"    = NOW()
  `

  // Assinatura: mantém o vencimento em dia e sinaliza inadimplência.
  if (pag.subscription) {
    await prisma.$executeRaw`
      UPDATE "AsaasAssinatura" SET
        "status" = CASE WHEN ${novoStatus}::text = 'OVERDUE' THEN 'OVERDUE'
                        WHEN ${pago}::boolean THEN 'ACTIVE'
                        ELSE "status" END,
        "proximoVencimento" = COALESCE(${pag.dueDate ?? null}::date, "proximoVencimento"),
        "updatedAt" = NOW()
      WHERE "subscriptionId" = ${pag.subscription}
    `

    // A cobrança vira ACESSO. Separado em lib/assinatura/acesso porque isto é
    // regra de negócio da assinatura, não contrato com o Asaas — e falha aqui
    // não pode desfazer o registro da cobrança, que já está gravado.
    try {
      const r = await aplicarNoAcesso({
        subscriptionId: pag.subscription,
        paymentId: pag.id,
        status: novoStatus,
        vencimento: pag.dueDate ?? null,
        valorLiquido: pag.netValue ?? null,
      })
      console.log(`[ASAAS-WH] acesso: ${r.tocou ? `${r.workspaceId} → ${r.novoStatus}` : `sem efeito (${r.motivo})`}`)
    } catch (e) {
      console.error('[ASAAS-WH] acesso não aplicado:', (e as Error)?.message)
    }
  }

  return { aplicado: true }
}

// ──────────────────────────── RETENÇÃO DO PAYLOAD ────────────────────────────

/** Dias que o payload cru (JSONB) sobrevive. A LINHA do evento fica para sempre. */
export const DIAS_RETENCAO_PAYLOAD = 90

/**
 * Expurga o PAYLOAD de eventos com mais de 90 dias, preservando a linha —
 * metadados (eventoId, tipo, ids, datas, erro) continuam para auditoria e para a
 * trava de idempotência, que depende do eventoId existir para sempre.
 *
 * Roda de forma OPORTUNISTA no próprio webhook, sem cron novo:
 *   - é uma única UPDATE apoiada no índice parcial "..._expurgo_idx", então quando
 *     não há nada a expurgar (o caso normal) o custo é praticamente zero;
 *   - o LIMIT limita o pior caso, e como roda a cada evento a fila drena sozinha;
 *   - linha expurgada sai do índice parcial, então o índice não cresce.
 *
 * Nunca lança: retenção não pode derrubar o recebimento de um pagamento.
 */
export async function expurgarPayloadsAntigos(lote = 200): Promise<number> {
  try {
    return await prisma.$executeRaw`
      UPDATE "AsaasWebhookEvento" SET "payload" = NULL
      WHERE "id" IN (
        SELECT "id" FROM "AsaasWebhookEvento"
        WHERE "payload" IS NOT NULL
          AND "createdAt" < NOW() - (${DIAS_RETENCAO_PAYLOAD} || ' days')::interval
        LIMIT ${lote}
      )
    `
  } catch (e) {
    console.warn('[ASAAS-WH] expurgo de payload falhou:', (e as Error)?.message)
    return 0
  }
}

/**
 * Reprocessa eventos que ficaram guardados sem efeito (tipicamente recebidos com a
 * feature flag OFF). Sem isto eles virariam órfãos: o Asaas não reenvia depois do 200.
 * Lê o payload MASCARADO do banco — os campos usados aqui (ids, valores, datas)
 * não são mascarados, então o reprocessamento é fiel.
 */
export async function reprocessarPendentes(limite = 100): Promise<{
  total: number; aplicados: number; falhas: number
}> {
  const pendentes = await prisma.$queryRaw`
    SELECT "id", "evento", "payload"
    FROM "AsaasWebhookEvento"
    WHERE "processadoEm" IS NULL
    ORDER BY "createdAt" ASC
    LIMIT ${limite}
  ` as { id: string; evento: string; payload: PayloadAsaas | null }[]

  let aplicados = 0
  let falhas = 0

  for (const ev of pendentes) {
    try {
      await aplicarEvento(ev.payload ?? {})
      await prisma.$executeRaw`
        UPDATE "AsaasWebhookEvento"
        SET "processadoEm" = NOW(), "erro" = NULL
        WHERE "id" = ${ev.id}
      `
      aplicados++
    } catch (e) {
      falhas++
      const msg = String((e as Error)?.message ?? 'erro').slice(0, 300)
      console.error(`[ASAAS-WH] reprocessar falhou id=${ev.id} evento=${ev.evento}:`, msg)
      await prisma.$executeRaw`
        UPDATE "AsaasWebhookEvento" SET "erro" = ${msg} WHERE "id" = ${ev.id}
      `.catch(() => {})
    }
  }

  return { total: pendentes.length, aplicados, falhas }
}
