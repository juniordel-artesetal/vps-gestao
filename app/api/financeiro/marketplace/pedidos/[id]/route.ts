import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ensureMarketplaceTables } from '@/lib/marketplaceSchema'
import { ensurePedidoMarketplaceTables } from '@/app/api/importacao/pedidos/_lib/schema'
import { carregarResolucao } from '../../_lib/custos'

const STATUS_VALIDOS = ['aguardando_envio', 'previsto', 'a_confirmar', 'recebido', 'cancelado']

// GET — detalhe do pedido: valores, cada taxa/desconto, líquido, custos item a item, margem
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  await ensureMarketplaceTables()
  await ensurePedidoMarketplaceTables()
  const { id } = await params
  const workspaceId = session.user.workspaceId
  const canal = 'shopee'

  // Nunca seleciona cpfCriptografado
  const rows = await prisma.$queryRaw`
    SELECT pm."id", pm."orderId", pm."idExterno", pm."statusExterno", pm."statusDevolucao",
      pm."destinatarioNome", pm."telefoneMascarado", pm."cidade", pm."uf",
      TO_CHAR(pm."dataCriacaoExterna",'YYYY-MM-DD') AS "data",
      pm."subtotalProdutos"::float AS "subtotalProdutos",
      pm."freteComprador"::float AS "frete", pm."freteEstimado"::float AS "freteEstimado",
      pm."descontoVendedor"::float AS "descontoVendedor", pm."descontoShopee"::float AS "descontoShopee",
      pm."cupomVendedor"::float AS "cupomVendedor", pm."cupomShopee"::float AS "cupomShopee",
      pm."valorTotal"::float AS "valorTotal", pm."totalGlobal"::float AS "totalGlobal",
      pm."taxaTransacao"::float AS "taxaTransacao",
      pm."comissaoBruta"::float AS "comissaoBruta", pm."comissaoLiquida"::float AS "comissaoLiquida",
      pm."servicoBruta"::float AS "servicoBruta", pm."servicoLiquida"::float AS "servicoLiquida",
      pm."freteReverso"::float AS "freteReverso", pm."liquidoEstimado"::float AS "liquido",
      r."status" AS "recStatus", TO_CHAR(r."dataPrevista",'YYYY-MM-DD') AS "dataPrevista",
      CASE WHEN r."status"='previsto' AND r."dataPrevista" IS NOT NULL AND r."dataPrevista" < CURRENT_DATE
           THEN 'a_confirmar' ELSE r."status" END AS "statusEfetivo"
    FROM "PedidoMarketplace" pm
    LEFT JOIN "Recebivel" r ON r."orderId" = pm."orderId" AND r."workspaceId" = pm."workspaceId"
    WHERE pm."id" = ${id} AND pm."workspaceId" = ${workspaceId} LIMIT 1
  ` as any[]
  if (rows.length === 0) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  const p = rows[0]

  const itensRaw = await prisma.$queryRaw`
    SELECT "id", "produto", "sku", "variacao", COALESCE("qtd",1)::int AS "qtd",
           "precoAcordado"::float AS "precoAcordado", "subtotal"::float AS "subtotal"
    FROM "PedidoMarketplaceItem"
    WHERE "pedidoMarketplaceId" = ${id} AND "workspaceId" = ${workspaceId}
    ORDER BY "produto"
  ` as any[]

  const resol = await carregarResolucao(workspaceId, canal)
  let custoTotal = 0, completo = itensRaw.length > 0
  const itens = itensRaw.map(it => {
    const { variacaoId, custo } = resol.custoDoItem(it.sku, it.produto, Number(it.qtd))
    if (custo === null) completo = false; else custoTotal += custo
    return {
      id: it.id, produto: it.produto, sku: it.sku, variacao: it.variacao, qtd: Number(it.qtd),
      precoAcordado: Number(it.precoAcordado || 0), subtotal: Number(it.subtotal || 0),
      vinculado: variacaoId !== null && custo !== null,
      variacaoId: variacaoId || null,
      custo: custo !== null ? Math.round(custo * 100) / 100 : null,
    }
  })
  const liquido = Number(p.liquido || 0)
  const margem = completo ? Math.round((liquido - custoTotal) * 100) / 100 : null

  return NextResponse.json(serialize({
    ...p, recStatus: undefined,
    itens,
    custoTotal: completo ? Math.round(custoTotal * 100) / 100 : null,
    margem, cobertura: itensRaw.length > 0 && completo,
    estimado: true,
  }))
}

// PUT — muda o recebível: dataPrevista editável / marcar recebido / cancelar / reabrir. Nunca cria FinLancamento.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  await ensureMarketplaceTables()
  const { id } = await params
  const workspaceId = session.user.workspaceId
  const { status, dataPrevista } = await req.json()

  // Resolve orderId a partir do PedidoMarketplace
  const pm = await prisma.$queryRaw`
    SELECT "orderId" FROM "PedidoMarketplace" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId} LIMIT 1
  ` as any[]
  const orderId = pm[0]?.orderId
  if (!orderId) return NextResponse.json({ error: 'Pedido sem recebível' }, { status: 404 })

  if (status !== undefined) {
    if (!STATUS_VALIDOS.includes(String(status)) || status === 'a_confirmar')
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
    await prisma.$executeRaw`
      UPDATE "Recebivel" SET "status" = ${status}, "updatedAt" = NOW()
      WHERE "workspaceId" = ${workspaceId} AND "orderId" = ${orderId}
    `
  }
  if (dataPrevista !== undefined) {
    await prisma.$executeRaw`
      UPDATE "Recebivel" SET "dataPrevista" = ${dataPrevista || null}::date, "updatedAt" = NOW()
      WHERE "workspaceId" = ${workspaceId} AND "orderId" = ${orderId}
    `
  }
  return NextResponse.json({ ok: true })
}
