// ─────────────────────────────────────────────────────────────────────────────
// Espelha o RECEBÍVEL de marketplace no FLUXO DE CAIXA (FinLancamento RECEITA).
//
// Problema que resolve: com o módulo "Números do Marketplace" ativo, o pedido cria
// um `Recebivel` (previsão) mas NUNCA um `FinLancamento` — então o dinheiro nunca
// aparecia no fluxo de caixa. Aqui o recebível passa a alimentar o caixa:
//   • previsto (enviado, com data prevista) → FinLancamento RECEITA PENDENTE (previsto)
//     na DATA PREVISTA, valor = LÍQUIDO (venda − taxas do canal).
//   • recebido (baixa) → o MESMO lançamento vira PAGO (realizado), na data certa.
//   • aguardando_envio / cancelado / sem data → não deve haver previsto (remove pendente).
//
// FONTE ÚNICA do líquido = `valorLiquidoEstimado` do recebível (já é venda − taxas,
// com as taxas reais do canal). IDEMPOTENTE por (workspaceId, tipo=RECEITA,
// referencia=orderId, descricao '[mkt-auto]…') — rerodar não duplica.
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from '@/lib/prisma'

function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

/** Sincroniza o FinLancamento espelho de UM recebível (pelo orderId). Read-safe/idempotente. */
export async function sincronizarReceitaRecebivel(workspaceId: string, orderId: string): Promise<void> {
  const [rec] = await prisma.$queryRaw`
    SELECT r."canal", r."valorLiquidoEstimado"::float AS liquido, r."status",
           TO_CHAR(r."dataPrevista",'YYYY-MM-DD') AS "dataPrevista", o."numero"
    FROM "Recebivel" r
    LEFT JOIN "Order" o ON o."id" = r."orderId" AND o."workspaceId" = r."workspaceId"
    WHERE r."workspaceId" = ${workspaceId} AND r."orderId" = ${orderId} LIMIT 1
  ` as any[]
  if (!rec) return

  const [ex] = await prisma.$queryRaw`
    SELECT "id", "status" FROM "FinLancamento"
    WHERE "workspaceId" = ${workspaceId} AND "tipo" = 'RECEITA' AND "referencia" = ${orderId}
      AND "descricao" LIKE '[mkt-auto]%' LIMIT 1
  ` as { id: string; status: string }[]

  const liquido = Number(rec.liquido || 0)
  const temPrevisao = (rec.status === 'previsto' || rec.status === 'recebido') && !!rec.dataPrevista && liquido > 0

  // Sem previsão válida (aguardando envio, cancelado, reaberto, sem data): remove o pendente espelho.
  if (!temPrevisao) {
    if (ex && ex.status === 'PENDENTE') await prisma.$executeRaw`DELETE FROM "FinLancamento" WHERE "id" = ${ex.id}`
    return
  }

  const recebido = rec.status === 'recebido'
  const canal = rec.canal || 'shopee'
  const desc = `[mkt-auto] Pedido ${rec.numero ? '#' + rec.numero : orderId} — ${canal}`
  const status = recebido ? 'PAGO' : 'PENDENTE'

  if (ex) {
    await prisma.$executeRaw`
      UPDATE "FinLancamento" SET
        "valor" = ${liquido}, "data" = ${rec.dataPrevista}::date, "canal" = ${canal}, "descricao" = ${desc},
        "status" = ${status},
        "dataRealizada"  = ${recebido ? rec.dataPrevista : null}::date,
        "valorRealizado" = ${recebido ? liquido : null}
      WHERE "id" = ${ex.id}
    `
  } else {
    await prisma.$executeRaw`
      INSERT INTO "FinLancamento"
        ("id","workspaceId","tipo","categoriaId","descricao","valor","data","status","dataRealizada","valorRealizado","canal","referencia")
      VALUES
        (${gerarId()}, ${workspaceId}, 'RECEITA', NULL, ${desc}, ${liquido}, ${rec.dataPrevista}::date, ${status},
         ${recebido ? rec.dataPrevista : null}::date, ${recebido ? liquido : null}, ${canal}, ${orderId})
    `
  }
}

/** Sincroniza vários recebíveis de uma vez (baixa em lote / backfill). */
export async function sincronizarReceitasRecebivel(workspaceId: string, orderIds: string[]): Promise<void> {
  for (const id of orderIds) {
    try { await sincronizarReceitaRecebivel(workspaceId, id) } catch (e) { console.error('[recebivelFluxo] sync', id, (e as Error)?.message) }
  }
}

/** Backfill: espelha no caixa todos os recebíveis previsto/recebido de um workspace. Idempotente. */
export async function backfillReceitasRecebivel(workspaceId: string): Promise<number> {
  const rows = await prisma.$queryRaw`
    SELECT "orderId" FROM "Recebivel"
    WHERE "workspaceId" = ${workspaceId} AND "status" IN ('previsto','recebido') AND "orderId" IS NOT NULL
  ` as { orderId: string }[]
  await sincronizarReceitasRecebivel(workspaceId, rows.map(r => r.orderId))
  return rows.length
}
