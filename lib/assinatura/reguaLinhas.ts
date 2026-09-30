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
      SELECT "subscriptionId", "proximoVencimento", "ciclo"
      FROM "AsaasAssinatura" WHERE "workspaceId" = w."id"
      ORDER BY "createdAt" DESC LIMIT 1
    ) a ON true
    WHERE w."assinaturaOrigem" = 'asaas'
      AND w."liberacaoManual" = false
      AND w."assinaturaStatus" NOT IN ('CORTADA', 'CANCELADA')
      -- Quem abandonou há mais de 6 dias já recebeu os QUATRO toques do follow-up:
      -- sai da varredura para o job não crescer com conta parada para sempre.
      AND (w."assinaturaStatus" <> 'AGUARDANDO_PAGAMENTO'
           OR w."checkoutCriadoEm" > NOW() - INTERVAL '150 hours')
  `) as LinhaRegua[]
}
