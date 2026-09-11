// Vendas e Números por marketplace — backbone dos submenus (Visão Geral, Vendas, Entregas,
// Cancelamentos/Devoluções, Repasses). SÓ LEITURA e SÓ das lojas SINCRONIZADAS via integração
// (PedidoMarketplace só é criado pelo sync — pedido digitado à mão fica de fora). Gated pelo
// módulo pago + ADMIN. Por workspaceId. Idempotente e sem PII em log.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { marketplacesLiberado, garantirColunaModuloMarketplaces } from '@/lib/marketplace/modulo'

export const dynamic = 'force-dynamic'

// Categorização por status do canal (regex tolerante às variações de nome por versão).
const RE_ENTREGUE = `'DELIVER|COMPLET'`
const RE_CANCEL = `'CANCEL|REFUND|RETURN'`
const RE_LOGISTICA = `'SHIP|TRANSIT|DELIVER|COMPLET|COLLECT|PACK|FULFILL'`

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId

  await garantirColunaModuloMarketplaces()
  if (!(await marketplacesLiberado(workspaceId))) return NextResponse.json({ liberado: false })

  const p = new URL(req.url).searchParams
  const de = p.get('de'), ate = p.get('ate')
  const canal = p.get('canal'), status = (p.get('status') || '').trim()
  const busca = (p.get('busca') || '').trim(), produto = (p.get('produto') || '').trim()
  const valorMin = p.get('valorMin'), valorMax = p.get('valorMax')
  const categoria = p.get('categoria') // entregas | cancelados | (default: todos)

  const dataRef = Prisma.sql`COALESCE(pm."dataPagamento", pm."dataCriacaoExterna")`
  const filtros = Prisma.sql`
    ${de ? Prisma.sql`AND ${dataRef} >= ${de}::date` : Prisma.empty}
    ${ate ? Prisma.sql`AND ${dataRef} <= ${ate}::date` : Prisma.empty}
    ${canal ? Prisma.sql`AND pm."canal" = ${canal}` : Prisma.empty}
    ${status ? Prisma.sql`AND pm."statusExterno" ILIKE ${'%' + status + '%'}` : Prisma.empty}
    ${valorMin ? Prisma.sql`AND pm."valorTotal" >= ${Number(valorMin)}` : Prisma.empty}
    ${valorMax ? Prisma.sql`AND pm."valorTotal" <= ${Number(valorMax)}` : Prisma.empty}
    ${busca ? Prisma.sql`AND (pm."destinatarioNome" ILIKE ${'%' + busca + '%'} OR pm."idExterno" ILIKE ${'%' + busca + '%'})` : Prisma.empty}
    ${produto ? Prisma.sql`AND EXISTS (SELECT 1 FROM "PedidoMarketplaceItem" i WHERE i."pedidoMarketplaceId" = pm."id" AND i."produto" ILIKE ${'%' + produto + '%'})` : Prisma.empty}
  `
  const catFiltro = categoria === 'entregas' ? Prisma.raw(`AND pm."statusExterno" ~* ${RE_LOGISTICA}`)
    : categoria === 'cancelados' ? Prisma.raw(`AND pm."statusExterno" ~* ${RE_CANCEL}`)
    : Prisma.empty

  // Lojas conectadas via integração (hoje: TikTok; ML/Shopee reusam quando conectarem).
  let lojasConectadas: any[] = []
  try {
    lojasConectadas = await prisma.$queryRaw`
      SELECT 'TikTok Shop' AS canal, "sellerName", "shopId", TO_CHAR("ultimaSync",'YYYY-MM-DD"T"HH24:MI') AS "ultimaSync"
      FROM "TikTokConexao" WHERE "workspaceId" = ${workspaceId} AND "conectado" = true
    ` as any[]
  } catch { lojasConectadas = [] }

  const resumo = await prisma.$queryRaw`
    SELECT pm."canal" AS "canal", COUNT(*)::int AS "pedidos",
           COALESCE(SUM(pm."valorTotal"),0)::float AS "bruto",
           COALESCE(SUM(pm."comissaoLiquida"),0)::float AS "taxas",
           COALESCE(SUM(pm."liquidoEstimado"),0)::float AS "liquido",
           COUNT(*) FILTER (WHERE pm."statusExterno" ~* ${Prisma.raw(RE_ENTREGUE)})::int AS "entregues",
           COUNT(*) FILTER (WHERE pm."statusExterno" ~* ${Prisma.raw(RE_CANCEL)})::int AS "cancelados"
    FROM "PedidoMarketplace" pm
    WHERE pm."workspaceId" = ${workspaceId} ${filtros}
    GROUP BY pm."canal" ORDER BY "bruto" DESC
  ` as any[]

  const serie = await prisma.$queryRaw`
    SELECT TO_CHAR(${dataRef}, 'YYYY-MM-DD') AS "dia", COUNT(*)::int AS "pedidos",
           COALESCE(SUM(pm."valorTotal"),0)::float AS "bruto"
    FROM "PedidoMarketplace" pm
    WHERE pm."workspaceId" = ${workspaceId} AND ${dataRef} IS NOT NULL ${filtros}
    GROUP BY 1 ORDER BY 1 ASC LIMIT 120
  ` as any[]

  const topProdutos = await prisma.$queryRaw`
    SELECT i."produto", SUM(i."qtd")::int AS "qtd", COALESCE(SUM(i."subtotal"),0)::float AS "total"
    FROM "PedidoMarketplaceItem" i
    JOIN "PedidoMarketplace" pm ON pm."id" = i."pedidoMarketplaceId"
    WHERE pm."workspaceId" = ${workspaceId} AND i."produto" IS NOT NULL ${filtros}
    GROUP BY i."produto" ORDER BY "total" DESC LIMIT 10
  ` as any[]

  // A receber (previsto) e recebido — do Recebivel dos pedidos de marketplace sincronizados.
  const receb = await prisma.$queryRaw`
    SELECT r."status", COALESCE(SUM(r."valorLiquidoEstimado"),0)::float AS "total"
    FROM "Recebivel" r
    JOIN "PedidoMarketplace" pm ON pm."orderId" = r."orderId" AND pm."workspaceId" = r."workspaceId"
    WHERE r."workspaceId" = ${workspaceId} ${filtros}
    GROUP BY r."status"
  ` as { status: string; total: number }[]
  const aReceber = receb.filter(r => r.status === 'previsto' || r.status === 'aguardando_envio').reduce((s, r) => s + r.total, 0)
  const recebido = receb.filter(r => r.status === 'recebido').reduce((s, r) => s + r.total, 0)

  const lista = await prisma.$queryRaw`
    SELECT pm."idExterno", pm."canal", pm."statusExterno" AS "status",
           TO_CHAR(${dataRef}, 'YYYY-MM-DD') AS "data",
           pm."valorTotal"::float AS "bruto", pm."liquidoEstimado"::float AS "liquido",
           pm."comissaoLiquida"::float AS "taxa",
           pm."destinatarioNome" AS "cliente", (to_jsonb(pm) ->> 'rastreio') AS "rastreio",
           (to_jsonb(pm) ->> 'fulfillmentStatus') AS "fulfillmentStatus",
           (pm."orderId" IS NOT NULL) AS "temPedido"
    FROM "PedidoMarketplace" pm
    WHERE pm."workspaceId" = ${workspaceId} ${filtros} ${catFiltro}
    ORDER BY ${dataRef} DESC NULLS LAST LIMIT 300
  ` as any[]

  const totais = resumo.reduce(
    (a, r) => ({
      pedidos: a.pedidos + Number(r.pedidos || 0), bruto: a.bruto + Number(r.bruto || 0),
      taxas: a.taxas + Number(r.taxas || 0), liquido: a.liquido + Number(r.liquido || 0),
      entregues: a.entregues + Number(r.entregues || 0), cancelados: a.cancelados + Number(r.cancelados || 0),
    }),
    { pedidos: 0, bruto: 0, taxas: 0, liquido: 0, entregues: 0, cancelados: 0 },
  )
  const ticketMedio = totais.pedidos > 0 ? totais.bruto / totais.pedidos : 0

  return NextResponse.json(serialize({
    liberado: true, lojasConectadas, resumoPorCanal: resumo,
    totais: { ...totais, ticketMedio, aReceber, recebido }, serie, topProdutos, lista,
  }))
}
