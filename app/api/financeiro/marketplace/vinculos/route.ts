import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ensureMarketplaceTables } from '@/lib/marketplaceSchema'
import { chaveDeItem } from '../_lib/custos'

// GET — variações disponíveis para vincular (dropdown do painel)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  await ensureMarketplaceTables()
  const workspaceId = session.user.workspaceId

  const variacoes = await prisma.$queryRaw`
    SELECT v."id", p."nome" AS "produtoNome", v."canal", v."tipo", v."subOpcao",
           COALESCE(v."custoTotal",0)::float AS "custoTotal"
    FROM "PrecVariacao" v
    INNER JOIN "PrecProduto" p ON p."id" = v."produtoId"
    WHERE p."workspaceId" = ${workspaceId} AND p."ativo" = true
    ORDER BY p."nome", v."canal", v."tipo"
  ` as any[]
  return NextResponse.json(serialize(variacoes))
}

// POST — cria/atualiza o vínculo chaveExterna (SKU ou nome normalizado) → variacaoId
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  await ensureMarketplaceTables()
  const workspaceId = session.user.workspaceId
  const { canal, sku, produto, variacaoId, chaveExterna } = await req.json()
  const ch = canal || 'shopee'

  const chave = (chaveExterna && String(chaveExterna).trim()) || chaveDeItem(sku ?? null, produto ?? null)
  if (!chave) return NextResponse.json({ error: 'Sem chave para vincular (SKU/produto vazios)' }, { status: 400 })
  if (!variacaoId) return NextResponse.json({ error: 'variacaoId obrigatório' }, { status: 400 })

  // Garante que a variação pertence ao workspace
  const okVar = await prisma.$queryRaw`
    SELECT v."id" FROM "PrecVariacao" v
    INNER JOIN "PrecProduto" p ON p."id" = v."produtoId"
    WHERE v."id" = ${variacaoId} AND p."workspaceId" = ${workspaceId} LIMIT 1
  ` as any[]
  if (okVar.length === 0) return NextResponse.json({ error: 'Variação inválida' }, { status: 400 })

  const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
  await prisma.$executeRaw`
    INSERT INTO "MarketplaceProdutoVinculo" ("id","workspaceId","canal","chaveExterna","variacaoId","createdAt")
    VALUES (${id}, ${workspaceId}, ${ch}, ${chave}, ${variacaoId}, NOW())
    ON CONFLICT ("workspaceId","canal","chaveExterna") DO UPDATE SET "variacaoId" = ${variacaoId}
  `
  return NextResponse.json({ ok: true, chaveExterna: chave })
}
