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
  // Sem produtoId → lista de produtos com o status de publicação (para o seletor da tela).
  if (!produtoId) {
    await ensureProdutoMarketplaceSchema()
    const produtos = await prisma.$queryRaw`
      SELECT p."id", p."nome", p."sku",
             COALESCE(v."status", 'nao_publicado') AS "status",
             (p."camposMarketplace" IS NOT NULL) AS "temCampos"
      FROM "PrecProduto" p
      LEFT JOIN "MarketplaceAnuncio" v ON v."produtoId" = p."id" AND v."workspaceId" = p."workspaceId" AND v."canal" = 'tiktokshop'
      WHERE p."workspaceId" = ${g.workspaceId} AND p."ativo" = true
      ORDER BY p."nome" ASC LIMIT 500
    ` as any[]
    return NextResponse.json(serialize({ produtos }))
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
  return NextResponse.json(serialize({ ok: true, validacao: validarCamposObrigatorios(campos) }))
}
