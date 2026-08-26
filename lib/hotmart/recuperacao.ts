// Rede de segurança: reativa workspaces BLOQUEADAS (ativo=false) que na verdade são
// pagantes Hotmart — última aprovação recente E último evento bom (não DELAYED/cancel).
// Fonte local: HotmartEvent (não depende da API). Idempotente e auditado.
import { prisma } from '@/lib/prisma'

// Seleção dos candidatos (bloqueadas mas pagando). $1 = janela em dias.
const SQL_CANDIDATOS = `
  SELECT c."wid", c."ultAprov"
  FROM (
    SELECT w."id" AS "wid",
      (SELECT MAX(he."createdAt") FROM "HotmartEvent" he
         WHERE (he."workspaceId" = w."id" OR (adm.email IS NOT NULL AND lower(he.email) = lower(adm.email)))
           AND he.evento IN ('PURCHASE_APPROVED','PURCHASE_COMPLETE')) AS "ultAprov",
      (SELECT he.evento FROM "HotmartEvent" he
         WHERE (he."workspaceId" = w."id" OR (adm.email IS NOT NULL AND lower(he.email) = lower(adm.email)))
         ORDER BY he."createdAt" DESC LIMIT 1) AS "ultEvento"
    FROM "Workspace" w
    LEFT JOIN LATERAL (
      SELECT u.email FROM "User" u WHERE u."workspaceId" = w."id" AND u."role" = 'ADMIN' ORDER BY u."createdAt" ASC LIMIT 1
    ) adm ON true
    WHERE w."ativo" = false AND w."liberacaoManual" = false
  ) c
  WHERE c."ultAprov" IS NOT NULL
    AND c."ultAprov" > NOW() - ($1 || ' days')::interval
    AND c."ultEvento" IN ('PURCHASE_APPROVED','PURCHASE_COMPLETE')
`

export async function recuperarPagantesHotmart(opts: { dryRun?: boolean; dias?: number } = {}) {
  const dias = String(opts.dias ?? 45)

  const candidatos = await prisma.$queryRawUnsafe(SQL_CANDIDATOS, dias) as { wid: string; ultAprov: Date }[]
  if (opts.dryRun || candidatos.length === 0) {
    return { candidatos: candidatos.length, reativados: 0, ids: candidatos.map(c => c.wid) }
  }

  // Reativa em bloco. assinaturaExpira = maior entre (últ. aprovação + 31d) e (hoje + 14d de
  // carência), pra não recortar antes da próxima cobrança Hotmart chegar. Guarda ativo=false
  // no WHERE = idempotente (não mexe em quem já está ativa).
  const reativados = await prisma.$executeRawUnsafe(`
    UPDATE "Workspace" w SET
      "ativo" = true,
      "assinaturaStatus" = 'ATIVA',
      "assinaturaOrigem" = 'hotmart',
      "cicloAssinatura" = COALESCE(w."cicloAssinatura", 'MENSAL'),
      "assinaturaExpira" = GREATEST((c."ultAprov"::date + INTERVAL '31 days')::date, CURRENT_DATE + 14),
      "liberacaoMotivo" = 'auto-reconciliacao Hotmart: pagante com aprovacao recente (rede de seguranca)',
      "updatedAt" = NOW()
    FROM ( ${SQL_CANDIDATOS} ) c
    WHERE w."id" = c."wid" AND w."ativo" = false AND w."liberacaoManual" = false
  `, dias)

  return { candidatos: candidatos.length, reativados: Number(reativados), ids: candidatos.map(c => c.wid) }
}
