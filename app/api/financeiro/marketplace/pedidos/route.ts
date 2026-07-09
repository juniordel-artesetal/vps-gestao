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
  const canal  = searchParams.get('canal') || 'shopee'
  const de     = searchParams.get('de')     || null
  const ate    = searchParams.get('ate')    || null
  const status = searchParams.get('status') || null // statusEfetivo do recebível
  const busca  = searchParams.get('busca')  || null
  const buscaLike = busca ? `%${busca}%` : null

  // Nunca seleciona cpfCriptografado. destinatarioNome (nome) é ok exibir.
  const rows = await prisma.$queryRaw`
    SELECT pm."id", pm."orderId", pm."idExterno", pm."destinatarioNome",
      TO_CHAR(pm."dataCriacaoExterna",'YYYY-MM-DD') AS "data",
      pm."valorTotal"::float AS "valorTotal", pm."freteComprador"::float AS "frete",
      pm."liquidoEstimado"::float AS "liquido",
      (COALESCE(pm."comissaoLiquida",0)+COALESCE(pm."servicoLiquida",0)+COALESCE(pm."taxaTransacao",0))::float AS "taxas",
      TO_CHAR(r."dataPrevista",'YYYY-MM-DD') AS "dataPrevista",
      CASE WHEN r."status"='previsto' AND r."dataPrevista" IS NOT NULL AND r."dataPrevista" < CURRENT_DATE
           THEN 'a_confirmar' ELSE r."status" END AS "statusEfetivo"
    FROM "PedidoMarketplace" pm
    LEFT JOIN "Recebivel" r ON r."orderId" = pm."orderId" AND r."workspaceId" = pm."workspaceId"
    WHERE pm."workspaceId" = ${workspaceId} AND pm."canal" = ${canal}
      AND (${de}::date  IS NULL OR pm."dataCriacaoExterna"::date >= ${de}::date)
      AND (${ate}::date IS NULL OR pm."dataCriacaoExterna"::date <= ${ate}::date)
      AND (${buscaLike}::text IS NULL OR pm."idExterno" ILIKE ${buscaLike} OR pm."destinatarioNome" ILIKE ${buscaLike})
    ORDER BY pm."dataCriacaoExterna" DESC NULLS LAST
    LIMIT 500
  ` as any[]

  // Itens para calcular margem/cobertura por pedido
  const ids = rows.map(r => r.id)
  const itens = ids.length > 0 ? (await prisma.$queryRaw`
    SELECT "pedidoMarketplaceId" AS "pmId", "sku", "produto", COALESCE("qtd",1)::int AS "qtd"
    FROM "PedidoMarketplaceItem"
    WHERE "workspaceId" = ${workspaceId} AND "pedidoMarketplaceId" = ANY(${ids}::text[])
  ` as any[]) : []
  const resol = await carregarResolucao(workspaceId, canal)
  const custoPorPedido = new Map<string, { custo: number; completo: boolean; nItens: number; naoVinc: number }>()
  for (const it of itens) {
    const cur = custoPorPedido.get(it.pmId) || { custo: 0, completo: true, nItens: 0, naoVinc: 0 }
    cur.nItens++
    const { custo } = resol.custoDoItem(it.sku, it.produto, Number(it.qtd))
    if (custo === null) { cur.completo = false; cur.naoVinc++ } else cur.custo += custo
    custoPorPedido.set(it.pmId, cur)
  }

  let pedidos = rows.map(r => {
    const c = custoPorPedido.get(r.id)
    const vinculado = !!c && c.nItens > 0 && c.completo
    return {
      id: r.id, orderId: r.orderId, idExterno: r.idExterno,
      destinatario: r.destinatarioNome, data: r.data,
      valorTotal: Number(r.valorTotal || 0), frete: Number(r.frete || 0),
      taxas: Number(r.taxas || 0), liquido: Number(r.liquido || 0),
      statusEfetivo: r.statusEfetivo || 'aguardando_envio',
      dataPrevista: r.dataPrevista,
      vinculado, nItens: c?.nItens || 0, naoVinculados: c?.naoVinc || 0,
      custo: vinculado ? Math.round(c!.custo * 100) / 100 : null,
      margem: vinculado ? Math.round((Number(r.liquido || 0) - c!.custo) * 100) / 100 : null,
    }
  })
  if (status) pedidos = pedidos.filter(p => p.statusEfetivo === status)

  return NextResponse.json(serialize({ pedidos, total: pedidos.length, estimado: true }))
}
