// RECONCILIAÇÃO dos pagamentos de assinaturas nascidas no CHECKOUT HOSPEDADO que ficaram SEM DONO.
//
// Causa (achada em 30/09/2026): as cobranças dessas assinaturas chegam no webhook SEM
// `externalReference` — só com `checkoutSession` (= Workspace.checkoutId). O webhook casava o
// workspace pelo externalReference, então pagamento de cartão do checkout NUNCA virava acesso:
// pagante ficava em TRIAL (ou era cortada) e a cobrança recusada nunca virava INADIMPLENTE.
// O webhook já foi corrigido; isto conserta o PASSADO (e qualquer evento que escape): acha os
// eventos guardados em "AsaasWebhookEvento", casa pelo checkoutSession e usa o caminho testado
// `vincularOrfao` (cria a AsaasAssinatura + ativa pela cobrança PAGA via aplicarNoAcesso).
//
// Roda no início do cron horário da régua — ANTES de decidir cortes (pagante nunca é cortado
// por falta de vínculo). Idempotente. NÃO toca workspace CANCELADA: essas estão sendo
// cobradas depois de cancelar (bug do cancelar-no-teste, corrigido) → decisão humana
// (estornar/apagar a assinatura ou reativar), só listadas.
import { prisma } from '@/lib/prisma'
import { vincularOrfao } from './vincularOrfao'

export interface ResultadoReconciliacao {
  vinculadas: { workspaceId: string; subscriptionId: string; ativou: boolean; motivo: string }[]
  canceladasCobradas: { workspaceId: string; subscriptionId: string; eventos: string }[]
  erros: string[]
}

export async function reconciliarPagamentosDoCheckout(): Promise<ResultadoReconciliacao> {
  const res: ResultadoReconciliacao = { vinculadas: [], canceladasCobradas: [], erros: [] }
  const pend = await prisma.$queryRaw`
    SELECT w."id" AS "workspaceId", w."assinaturaStatus", e.payload->'payment'->>'subscription' AS "subscriptionId",
           string_agg(e."evento", ',' ORDER BY e."createdAt") AS eventos
    FROM "AsaasWebhookEvento" e
    JOIN "Workspace" w ON w."checkoutId" = e.payload->'payment'->>'checkoutSession'
    WHERE e.payload->'payment'->>'subscription' IS NOT NULL
      AND e.payload->'payment'->>'checkoutSession' IS NOT NULL
      AND w."assinaturaOrigem" = 'asaas'
      AND NOT EXISTS (SELECT 1 FROM "AsaasAssinatura" a WHERE a."subscriptionId" = e.payload->'payment'->>'subscription')
    GROUP BY 1, 2, 3
    LIMIT 50
  ` as { workspaceId: string; assinaturaStatus: string; subscriptionId: string; eventos: string }[]

  for (const p of pend) {
    if (p.assinaturaStatus === 'CANCELADA') { res.canceladasCobradas.push({ workspaceId: p.workspaceId, subscriptionId: p.subscriptionId, eventos: p.eventos }); continue }
    try {
      // As cobranças já estão em AsaasCobranca (o webhook grava antes de casar) — só sem dono.
      await prisma.$executeRaw`
        UPDATE "AsaasCobranca" SET "workspaceId" = ${p.workspaceId}, "updatedAt" = NOW()
        WHERE "subscriptionId" = ${p.subscriptionId} AND "workspaceId" IS NULL
      `
      const r = await vincularOrfao(p.workspaceId, p.subscriptionId)
      res.vinculadas.push({ workspaceId: p.workspaceId, subscriptionId: p.subscriptionId, ativou: !!r.ativou, motivo: r.motivo })
      console.log(`[RECONCILIA-CHECKOUT] ws=${p.workspaceId} sub=${p.subscriptionId} → ${r.motivo}`)
    } catch (e) {
      res.erros.push(`${p.workspaceId}/${p.subscriptionId}: ${(e as Error)?.message?.slice(0, 200)}`)
    }
  }
  if (res.canceladasCobradas.length) {
    console.error(`[RECONCILIA-CHECKOUT] ${res.canceladasCobradas.length} workspace(s) CANCELADA(s) com cobrança da assinatura do checkout — revisar (estornar/apagar ou reativar)`)
  }
  return res
}
