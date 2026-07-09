import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ensureMarketplaceTables } from '@/lib/marketplaceSchema'
import { ensurePedidoMarketplaceTables } from '@/app/api/importacao/pedidos/_lib/schema'
import { carregarResolucao } from '../_lib/custos'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  await ensureMarketplaceTables()
  await ensurePedidoMarketplaceTables()

  const workspaceId = session.user.workspaceId
  const { searchParams } = new URL(req.url)
  const canal = searchParams.get('canal') || 'shopee'
  const de  = searchParams.get('de')  || null
  const ate = searchParams.get('ate') || null

  const cfg = await prisma.$queryRaw`
    SELECT "ativo", "diasRepasse"::int AS "diasRepasse" FROM "MarketplaceConfig"
    WHERE "workspaceId" = ${workspaceId} AND "canal" = ${canal} LIMIT 1
  ` as any[]
  const ativo = !!cfg[0]?.ativo
  if (!ativo) return NextResponse.json(serialize({ ativo: false, canal }))

  // ── KPIs do período (sobre a camada fiscal) ──────────────────────────────
  const [kpi] = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS "nPedidos",
      COALESCE(SUM("valorTotal"),0)::float AS "bruto",
      COALESCE(SUM("freteComprador"),0)::float AS "frete",
      COALESCE(SUM(COALESCE("descontoVendedor",0)+COALESCE("descontoShopee",0)+COALESCE("cupomVendedor",0)+COALESCE("cupomShopee",0)),0)::float AS "descontos",
      COALESCE(SUM(COALESCE("comissaoLiquida",0)+COALESCE("servicoLiquida",0)+COALESCE("taxaTransacao",0)),0)::float AS "totalTaxas",
      COALESCE(SUM("liquidoEstimado"),0)::float AS "liquidoEstimado"
    FROM "PedidoMarketplace"
    WHERE "workspaceId" = ${workspaceId} AND "canal" = ${canal}
      AND (${de}::date  IS NULL OR "dataCriacaoExterna"::date >= ${de}::date)
      AND (${ate}::date IS NULL OR "dataCriacaoExterna"::date <= ${ate}::date)
  ` as any[]
  const bruto = Number(kpi?.bruto || 0)
  const kpis = {
    nPedidos: Number(kpi?.nPedidos || 0),
    bruto,
    frete: Number(kpi?.frete || 0),
    descontos: Number(kpi?.descontos || 0),
    totalTaxas: Number(kpi?.totalTaxas || 0),
    pctTaxas: bruto > 0 ? Math.round((Number(kpi?.totalTaxas || 0) / bruto) * 1000) / 10 : 0,
    liquidoEstimado: Number(kpi?.liquidoEstimado || 0),
    ticketMedio: Number(kpi?.nPedidos || 0) > 0 ? Math.round((bruto / Number(kpi.nPedidos)) * 100) / 100 : 0,
  }

  // ── Previsão de recebimento (4 estados; a_confirmar = previsto vencido) ───
  const prevRows = await prisma.$queryRaw`
    SELECT
      CASE WHEN "status"='previsto' AND "dataPrevista" IS NOT NULL AND "dataPrevista" < CURRENT_DATE
           THEN 'a_confirmar' ELSE "status" END AS "st",
      COUNT(*)::int AS "n", COALESCE(SUM("valorLiquidoEstimado"),0)::float AS "valor"
    FROM "Recebivel"
    WHERE "workspaceId" = ${workspaceId} AND "canal" = ${canal}
    GROUP BY 1
  ` as any[]
  const previsao: Record<string, { n: number; valor: number }> = {
    aguardando_envio: { n: 0, valor: 0 }, previsto: { n: 0, valor: 0 },
    a_confirmar: { n: 0, valor: 0 }, recebido: { n: 0, valor: 0 }, cancelado: { n: 0, valor: 0 },
  }
  for (const r of prevRows) if (previsao[r.st]) previsao[r.st] = { n: Number(r.n), valor: Number(r.valor) }

  // ── Card comparativo (READ-ONLY) — nunca altera o caixa ───────────────────
  const [comp] = await prisma.$queryRaw`
    SELECT COALESCE(SUM("valorLiquidoEstimado"),0)::float AS "previstoPeriodo"
    FROM "Recebivel"
    WHERE "workspaceId" = ${workspaceId} AND "canal" = ${canal}
      AND "status" IN ('previsto')
      AND (${de}::date  IS NULL OR "dataPrevista" >= ${de}::date)
      AND (${ate}::date IS NULL OR "dataPrevista" <= ${ate}::date)
  ` as any[]
  const [rec] = await prisma.$queryRaw`
    SELECT COALESCE(SUM("valor"),0)::float AS "receitasLancadas"
    FROM "FinLancamento"
    WHERE "workspaceId" = ${workspaceId} AND "tipo" = 'RECEITA' AND "status" = 'PAGO'
      AND (${de}::date  IS NULL OR "data"::date >= ${de}::date)
      AND (${ate}::date IS NULL OR "data"::date <= ${ate}::date)
  ` as any[]

  // ── Margem / cobertura (JS: resolve custo item a item via vínculos) ───────
  const resol = await carregarResolucao(workspaceId, canal)
  const linhas = await prisma.$queryRaw`
    SELECT pm."id", pm."liquidoEstimado"::float AS "liquido",
           i."sku", i."produto", COALESCE(i."qtd",1)::int AS "qtd"
    FROM "PedidoMarketplace" pm
    LEFT JOIN "PedidoMarketplaceItem" i ON i."pedidoMarketplaceId" = pm."id"
    WHERE pm."workspaceId" = ${workspaceId} AND pm."canal" = ${canal}
      AND (${de}::date  IS NULL OR pm."dataCriacaoExterna"::date >= ${de}::date)
      AND (${ate}::date IS NULL OR pm."dataCriacaoExterna"::date <= ${ate}::date)
  ` as any[]
  const porPedido = new Map<string, { liquido: number; custo: number; completo: boolean; temItem: boolean }>()
  for (const l of linhas) {
    const cur = porPedido.get(l.id) || { liquido: Number(l.liquido || 0), custo: 0, completo: true, temItem: false }
    if (l.produto !== null || l.sku !== null) {
      cur.temItem = true
      const { custo } = resol.custoDoItem(l.sku, l.produto, Number(l.qtd))
      if (custo === null) cur.completo = false
      else cur.custo += custo
    }
    porPedido.set(l.id, cur)
  }
  let cobertos = 0, lucroTotal = 0, custoTotal = 0
  const totalPedidos = porPedido.size
  for (const p of porPedido.values()) {
    if (p.temItem && p.completo) { cobertos++; custoTotal += p.custo; lucroTotal += (p.liquido - p.custo) }
  }
  const margem = {
    totalPedidos,
    cobertos,
    cobertura: totalPedidos > 0 ? Math.round((cobertos / totalPedidos) * 1000) / 10 : 0,
    custo: Math.round(custoTotal * 100) / 100,
    lucro: Math.round(lucroTotal * 100) / 100,
  }

  return NextResponse.json(serialize({
    ativo: true, canal, diasRepasse: cfg[0]?.diasRepasse ?? 7,
    periodo: { de, ate },
    kpis, previsao, margem,
    comparativo: {
      previstoPeriodo: Number(comp?.previstoPeriodo || 0),
      receitasLancadas: Number(rec?.receitasLancadas || 0),
    },
    estimado: true,
  }))
}
