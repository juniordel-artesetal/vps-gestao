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
import { resolverTaxa, calcularLiquido } from '@/lib/canaisVenda'

function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

const CANAIS_MARKETPLACE = ['shopee', 'mercado livre', 'mercadolivre', 'tiktok', 'amazon', 'elo7', 'magalu', 'magazine', 'shein']
export function ehCanalMarketplace(canal: string | null | undefined): boolean {
  const c = (canal || '').toLowerCase().trim()
  if (!c) return false
  return c === 'ml' || CANAIS_MARKETPLACE.some(m => c === m || c.includes(m))
}

/**
 * Garante a receita PREVISTA no caixa de um pedido de marketplace que está ENVIADO —
 * inclusive quando ele NÃO tem recebível (o "Números do Marketplace" não rodou a importação).
 * Sem essa cobertura, o pedido enviado ficava sem NENHUMA entrada no fluxo.
 *   • Tem recebível → usa o líquido do import (sincronizarReceitaRecebivel).
 *   • Marketplace sem recebível → cria FinLancamento RECEITA PENDENTE (previsto), na DATA DE
 *     ENVIO, com valor LÍQUIDO (venda − taxa do canal, quando resolvível; senão o bruto editável).
 * Idempotente: se o pedido já tem QUALQUER receita vinculada (por referencia), não duplica.
 */
export async function garantirReceitaEnviado(workspaceId: string, orderId: string): Promise<{ criado: boolean; motivo: string }> {
  const [o] = await prisma.$queryRaw`
    SELECT o."status", o."canal", o."numero",
           COALESCE(o."valor", o."valorTotal")::float AS valor,
           TO_CHAR(o."dataEnvio",'YYYY-MM-DD') AS "dataEnvio"
    FROM "Order" o WHERE o."id" = ${orderId} AND o."workspaceId" = ${workspaceId} LIMIT 1
  ` as any[]
  if (!o) return { criado: false, motivo: 'pedido não encontrado' }
  if (o.status !== 'ENVIADO') return { criado: false, motivo: 'não está ENVIADO' }
  const valor = Number(o.valor || 0)
  if (valor <= 0) return { criado: false, motivo: 'pedido sem valor' }

  // Tem recebível? → fluxo do recebível (líquido do import).
  const [rec] = await prisma.$queryRaw`SELECT 1 AS x FROM "Recebivel" WHERE "workspaceId" = ${workspaceId} AND "orderId" = ${orderId} LIMIT 1` as any[]
  if (rec) { await sincronizarReceitaRecebivel(workspaceId, orderId); return { criado: true, motivo: 'via recebível (líquido do import)' } }

  if (!ehCanalMarketplace(o.canal)) return { criado: false, motivo: 'canal não-marketplace (tratado pelo fluxo padrão)' }

  // Idempotência: qualquer receita já vinculada ao pedido (por referencia) → não duplica.
  const refs = [orderId, o.numero].filter(Boolean) as string[]
  const [ja] = await prisma.$queryRaw`
    SELECT "id" FROM "FinLancamento" WHERE "workspaceId" = ${workspaceId} AND "tipo" = 'RECEITA' AND "referencia" = ANY(${refs}::text[]) LIMIT 1
  ` as any[]
  if (ja) return { criado: false, motivo: 'pedido já tem lançamento' }

  // Líquido = venda − taxa do canal (best-effort). Sem catálogo/config → bruto (editável).
  let liquido = valor
  let obs = '[mkt-auto] valor bruto — confira/ajuste as taxas do canal'
  try {
    const taxa = await resolverTaxa(workspaceId, o.canal || '', { preco: valor })
    const liq = calcularLiquido(valor, taxa)
    if (liq > 0 && liq < valor) { liquido = liq; obs = `[mkt-auto] bruto=${valor.toFixed(2)} líq=${liq.toFixed(2)}` }
  } catch {}

  const data = o.dataEnvio || new Date().toISOString().slice(0, 10)
  const desc = `[mkt-auto] Pedido ${o.numero ? '#' + o.numero : orderId} — ${o.canal}`
  await prisma.$executeRaw`
    INSERT INTO "FinLancamento"
      ("id","workspaceId","tipo","categoriaId","descricao","valor","data","status","canal","referencia","observacoes")
    VALUES
      (${gerarId()}, ${workspaceId}, 'RECEITA', NULL, ${desc}, ${liquido}, ${data}::date, 'PENDENTE', ${o.canal}, ${orderId}, ${obs})
  `
  return { criado: true, motivo: `previsto criado na data de envio (${data})` }
}

/** Backfill dos pedidos ENVIADO de marketplace SEM lançamento. dryRun lista sem gravar. */
export async function backfillEnviadosSemLancamento(workspaceId: string, dryRun: boolean): Promise<{ pedidos: any[]; criados: number }> {
  const cand = await prisma.$queryRaw`
    SELECT o."id", o."numero", o."canal", TO_CHAR(o."dataEnvio",'YYYY-MM-DD') AS "dataEnvio",
           COALESCE(o."valor", o."valorTotal")::float AS valor
    FROM "Order" o
    WHERE o."workspaceId" = ${workspaceId} AND o."status" = 'ENVIADO'
      AND COALESCE(o."valor", o."valorTotal") > 0
      AND NOT EXISTS (
        SELECT 1 FROM "FinLancamento" f
        WHERE f."workspaceId" = ${workspaceId} AND f."tipo" = 'RECEITA'
          AND f."referencia" IN (o."id", o."numero")
      )
    ORDER BY o."dataEnvio" DESC NULLS LAST
  ` as any[]
  const alvo = cand.filter(p => ehCanalMarketplace(p.canal))
  if (dryRun) return { pedidos: alvo, criados: 0 }
  let criados = 0
  for (const p of alvo) {
    try { const r = await garantirReceitaEnviado(workspaceId, p.id); if (r.criado) criados++ } catch (e) { console.error('[backfill]', p.id, (e as Error)?.message) }
  }
  return { pedidos: alvo, criados }
}

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
