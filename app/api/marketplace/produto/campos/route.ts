// Campos "Dados do Marketplace" de um produto (item D) + status do vínculo. Gated + ADMIN.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serialize } from '@/lib/serialize'
import { marketplacesLiberado } from '@/lib/marketplace/modulo'
import { prisma } from '@/lib/prisma'
import { lerCampos, salvarCampos, validarCamposObrigatorios, lerVinculo, ensureProdutoMarketplaceSchema } from '@/lib/marketplace/produtoCampos'

export const dynamic = 'force-dynamic'

async function guard() {
  const session = await getServerSession(authOptions)
  if (!session) return { erro: 'Não autenticado', status: 401 as const }
  if (session.user.role !== 'ADMIN') return { erro: 'Sem permissão', status: 403 as const }
  if (!(await marketplacesLiberado(session.user.workspaceId))) return { erro: 'Módulo indisponível', status: 404 as const }
  return { workspaceId: session.user.workspaceId }
}

export async function GET(req: NextRequest) {
  const g = await guard(); if ('erro' in g) return NextResponse.json({ error: g.erro }, { status: g.status })
  const produtoId = new URL(req.url).searchParams.get('produtoId')
  // Sem produtoId → lista de VARIAÇÕES (cada uma com o selo do seu canal/loja), preço e status.
  // A publicação no TikTok é por produto (as variações TikTok viram SKUs do mesmo anúncio),
  // então o status de uma variação TikTok reflete o MarketplaceAnuncio do produto (canal tiktokshop).
  if (!produtoId) {
    await ensureProdutoMarketplaceSchema()
    const variacoes = await prisma.$queryRaw`
      SELECT vv."id" AS "variacaoId", vv."produtoId", p."nome" AS "produtoNome",
             vv."nome" AS "variacaoNome", vv."tipo", vv."subOpcao", vv."canal",
             vv."precoVenda"::float AS "preco",
             (p."camposMarketplace" IS NOT NULL) AS "temCampos",
             COALESCE(a."status", 'nao_publicado') AS "statusAnuncio"
      FROM "PrecVariacao" vv
      JOIN "PrecProduto" p ON p."id" = vv."produtoId"
      LEFT JOIN "MarketplaceAnuncio" a ON a."produtoId" = vv."produtoId" AND a."workspaceId" = p."workspaceId" AND a."canal" = 'tiktokshop'
      WHERE p."workspaceId" = ${g.workspaceId} AND p."ativo" = true
      ORDER BY p."nome" ASC, vv."nome" ASC NULLS FIRST, vv."subOpcao" ASC
      LIMIT 1000
    ` as any[]
    return NextResponse.json(serialize({ variacoes }))
  }
  const campos = await lerCampos(g.workspaceId, produtoId)
  const vinculo = await lerVinculo(g.workspaceId, produtoId, 'tiktokshop')
  return NextResponse.json(serialize({ campos, vinculo, validacao: validarCamposObrigatorios(campos) }))
}

export async function PUT(req: NextRequest) {
  const g = await guard(); if ('erro' in g) return NextResponse.json({ error: g.erro }, { status: g.status })
  const body = await req.json().catch(() => ({}))
  const produtoId = String(body?.produtoId ?? '')
  if (!produtoId) return NextResponse.json({ error: 'produtoId obrigatório' }, { status: 400 })
  await salvarCampos(g.workspaceId, produtoId, body?.campos ?? {})
  const campos = await lerCampos(g.workspaceId, produtoId)
  // Completar os campos publica o que estava "pendente" (se o canal TikTok está marcado). Fail-open.
  const { publicarSeMarcadoTikTok } = await import('@/lib/marketplace/autoPublicar')
  await publicarSeMarcadoTikTok(g.workspaceId, produtoId)
  return NextResponse.json(serialize({ ok: true, validacao: validarCamposObrigatorios(campos) }))
}
