// Linhas que a RÉGUA avalia (cron horário e prévia do Master usam exatamente o mesmo SELECT).
// Só origem Asaas, sem liberação manual, fora de CORTADA/CANCELADA.
import { prisma } from '@/lib/prisma'
import type { LinhaRegua } from './regua'

export async function carregarLinhasRegua(): Promise<LinhaRegua[]> {
  return (await prisma.$queryRaw`
    SELECT w."id" AS "workspaceId", w."assinaturaOrigem", w."assinaturaStatus",
           w."liberacaoManual", w."ativo", w."trialAte", w."assinaturaExpira",
           w."checkoutCriadoEm", w."metodoEscolhido", w."planoEscolhido", w."segmento",
           a."proximoVencimento", a."ciclo",
           -- a assinatura no Asaas segue VIVA (a cobrança contínua só vale enquanto ela não cancelar)
           (a."subscriptionId" IS NOT NULL AND a."status" IN ('ACTIVE', 'OVERDUE') AND a."canceladaEm" IS NULL) AS "assinaturaViva",
           EXISTS (
             SELECT 1 FROM "AsaasCobranca" c
             WHERE c."subscriptionId" = a."subscriptionId" AND c."status" = 'OVERDUE'
           ) AS "parcelaFalhou",
           -- Pagamento REAL confirmado em qualquer cobrança do workspace: a régua NUNCA
           -- corta quem tem isto (guarda anti-corte-de-pagante).
           -- Pagou o período VIGENTE (cobrança paga que cobre o vencimento em aberto) — status só atrasado.
           (EXISTS (
             SELECT 1 FROM "AsaasCobranca" c2
             WHERE (c2."workspaceId" = w."id"
                    OR c2."subscriptionId" IN (SELECT a2."subscriptionId" FROM "AsaasAssinatura" a2 WHERE a2."workspaceId" = w."id"))
               AND c2."status" IN ('CONFIRMED','RECEIVED') AND c2."sandbox" = false
               AND (w."assinaturaExpira" IS NULL OR c2."vencimento" >= w."assinaturaExpira"::date)
           ) OR (w."checkoutId" IS NOT NULL AND EXISTS (
             -- pagamento do checkout hospedado ainda sem vínculo (chega sem externalReference)
             SELECT 1 FROM "AsaasWebhookEvento" e2
             WHERE e2.payload->'payment'->>'checkoutSession' = w."checkoutId"
               AND e2."evento" IN ('PAYMENT_CONFIRMED','PAYMENT_RECEIVED')
               -- pagamento ESTORNADO/contestado depois não conta (senão vira acesso grátis eterno)
               AND NOT EXISTS (
                 SELECT 1 FROM "AsaasWebhookEvento" e3
                 WHERE e3.payload->'payment'->>'id' = e2.payload->'payment'->>'id'
                   AND e3."evento" IN ('PAYMENT_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_DELETED')
               )
           ))) AS "temPagamentoConfirmado",
           -- Já pagou ALGUMA vez (renovação que falhou ≠ calote: protegida só na janela de recuperação).
           EXISTS (
             SELECT 1 FROM "AsaasCobranca" c3
             WHERE (c3."workspaceId" = w."id"
                    OR c3."subscriptionId" IN (SELECT a3."subscriptionId" FROM "AsaasAssinatura" a3 WHERE a3."workspaceId" = w."id"))
               AND c3."status" IN ('CONFIRMED','RECEIVED') AND c3."sandbox" = false
           ) AS "pagouAntes"
    FROM "Workspace" w
    LEFT JOIN LATERAL (
      SELECT "subscriptionId", "proximoVencimento", "ciclo", "status", "canceladaEm"
      FROM "AsaasAssinatura" WHERE "workspaceId" = w."id"
      ORDER BY "createdAt" DESC LIMIT 1
    ) a ON true
    WHERE w."assinaturaOrigem" = 'asaas'
      AND w."liberacaoManual" = false
      -- cancelada sai; CORTADA só com a assinatura viva (cobrança contínua até cancelar)
      AND w."assinaturaStatus" IS DISTINCT FROM 'CANCELADA'
      AND (w."assinaturaStatus" IS DISTINCT FROM 'CORTADA'
           OR (a."subscriptionId" IS NOT NULL AND a."status" IN ('ACTIVE', 'OVERDUE') AND a."canceladaEm" IS NULL))
      -- Quem abandonou há mais de 6 dias já recebeu os QUATRO toques do follow-up:
      -- sai da varredura para o job não crescer com conta parada para sempre.
      AND (w."assinaturaStatus" <> 'AGUARDANDO_PAGAMENTO'
           OR w."checkoutCriadoEm" > NOW() - INTERVAL '150 hours')
  `) as LinhaRegua[]
}

/**
 * Assinaturas da HOTMART em atraso que a régua cobra: a mesma regra do painel de Receitas (estado mais recente do
 * assinante — eventos + espelho do sync —, sem ter migrado para o Asaas, sem cancelamento). Fora: liberação manual,
 * conta CANCELADA e conta que hoje é do Asaas (cobrar a Hotmart dela seria cobrança dupla). `ultimoAviso` = o último
 * lembrete da Hotmart enviado (o ritmo é a cada 7 dias a partir dele).
 */
export async function carregarAtrasosHotmart(): Promise<{ workspaceId: string; liberacaoManual: boolean; ultimoAviso: Date | null }[]> {
  const { hotmartEmAtraso } = await import('@/lib/master/receitas')
  const ids = [...new Set((await hotmartEmAtraso()).map(a => a.workspaceId))]
  if (!ids.length) return []
  return (await prisma.$queryRaw`
    SELECT w."id" AS "workspaceId", w."liberacaoManual",
           (SELECT MAX(a."enviadoEm") FROM "AssinaturaAviso" a WHERE a."workspaceId" = w."id" AND a."tipo" = 'HOTMART_ATRASO') AS "ultimoAviso"
    FROM "Workspace" w
    WHERE w."id" = ANY(${ids}::text[])
      AND w."assinaturaStatus" IS DISTINCT FROM 'CANCELADA'
      AND w."assinaturaOrigem" IS DISTINCT FROM 'asaas'
  `) as { workspaceId: string; liberacaoManual: boolean; ultimoAviso: Date | null }[]
}
