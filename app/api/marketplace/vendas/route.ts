// Vendas e Números por marketplace — base do menu "Integração com Marketplace".
// Só LEITURA de PedidoMarketplace, agregado por canal e período, com filtros. Gated pelo
// módulo pago (marketplacesLiberado) + ADMIN. Por workspaceId. Estado vazio amigável.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { marketplacesLiberado, garantirColunaModuloMarketplaces } from '@/lib/marketplace/modulo'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId

  await garantirColunaModuloMarketplaces()
  if (!(await marketplacesLiberado(workspaceId))) {
    // Sem o módulo pago (ou técnico off): a tela mostra o upsell.
    return NextResponse.json({ liberado: false })
  }

  const p = new URL(req.url).searchParams
  const de = p.get('de'), ate = p.get('ate')
  const canal = p.get('canal'), status = (p.get('status') || '').trim()
  const busca = (p.get('busca') || '').trim()
  const produto = (p.get('produto') || '').trim()
  const valorMin = p.get('valorMin'), valorMax = p.get('valorMax')

  // Data de referência da venda: pagamento quando houver, senão criação.
  const dataRef = Prisma.sql`COALESCE(pm."dataPagamento", pm."dataCriacaoExterna")`
  const fDe = de ? Prisma.sql`AND ${dataRef} >= ${de}::date` : Prisma.empty
  const fAte = ate ? Prisma.sql`AND ${dataRef} <= ${ate}::date` : Prisma.empty
  const fCanal = canal ? Prisma.sql`AND pm."canal" = ${canal}` : Prisma.empty
  const fStatus = status ? Prisma.sql`AND pm."statusExterno" ILIKE ${'%' + status + '%'}` : Prisma.empty
  const fVMin = valorMin ? Prisma.sql`AND pm."valorTotal" >= ${Number(valorMin)}` : Prisma.empty
  const fVMax = valorMax ? Prisma.sql`AND pm."valorTotal" <= ${Number(valorMax)}` : Prisma.empty
  const fBusca = busca
    ? Prisma.sql`AND (pm."destinatarioNome" ILIKE ${'%' + busca + '%'} OR pm."idExterno" ILIKE ${'%' + busca + '%'})`
    : Prisma.empty
  const fProduto = produto
    ? Prisma.sql`AND EXISTS (SELECT 1 FROM "PedidoMarketplaceItem" i WHERE i."pedidoMarketplaceId" = pm."id" AND i."produto" ILIKE ${'%' + produto + '%'})`
    : Prisma.empty
  const filtros = Prisma.sql`${fDe} ${fAte} ${fCanal} ${fStatus} ${fVMin} ${fVMax} ${fBusca} ${fProduto}`

  const resumo = await prisma.$queryRaw`
    SELECT pm."canal" AS "canal",
           COUNT(*)::int AS "pedidos",
           COALESCE(SUM(pm."valorTotal"), 0)::float AS "bruto",
           COALESCE(SUM(pm."comissaoLiquida"), 0)::float AS "taxas",
           COALESCE(SUM(pm."liquidoEstimado"), 0)::float AS "liquido"
    FROM "PedidoMarketplace" pm
    WHERE pm."workspaceId" = ${workspaceId} ${filtros}
    GROUP BY pm."canal"
    ORDER BY "bruto" DESC
  ` as any[]

  const lista = await prisma.$queryRaw`
    SELECT pm."idExterno", pm."canal", pm."statusExterno" AS "status",
           TO_CHAR(${dataRef}, 'YYYY-MM-DD') AS "data",
           pm."valorTotal"::float AS "bruto", pm."liquidoEstimado"::float AS "liquido",
           pm."destinatarioNome" AS "cliente", (pm."orderId" IS NOT NULL) AS "temPedido"
    FROM "PedidoMarketplace" pm
    WHERE pm."workspaceId" = ${workspaceId} ${filtros}
    ORDER BY ${dataRef} DESC NULLS LAST
    LIMIT 300
  ` as any[]

  const totais = resumo.reduce(
    (a, r) => ({
      pedidos: a.pedidos + Number(r.pedidos || 0),
      bruto: a.bruto + Number(r.bruto || 0),
      taxas: a.taxas + Number(r.taxas || 0),
      liquido: a.liquido + Number(r.liquido || 0),
    }),
    { pedidos: 0, bruto: 0, taxas: 0, liquido: 0 },
  )

  return NextResponse.json(serialize({ liberado: true, resumoPorCanal: resumo, totais, lista }))
}
