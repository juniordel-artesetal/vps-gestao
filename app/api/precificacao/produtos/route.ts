import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const workspaceId = session.user.workspaceId
    const produtos = await prisma.$queryRaw`
      SELECT p.*,
        COALESCE(json_agg(
          json_build_object(
            'id', v."id", 'qtdKit', v."qtdKit",
            'custoMaterial', v."custoMaterial", 'custoMaoObra', v."custoMaoObra",
            'custoEmbalagem', v."custoEmbalagem", 'custoArte', v."custoArte",
            'custoTotal', v."custoTotal", 'precoVenda', v."precoVenda",
            'precoPromocional', v."precoPromocional", 'metaVendas', v."metaVendas",
            'tipo', v."tipo", 'isKit', v."isKit", 'canal', v."canal",
            'subOpcao', v."subOpcao", 'impostos', v."impostos",
            'emPromo', v."emPromo", 'descontoPct', v."descontoPct",
            'materiais', (
              SELECT COALESCE(json_agg(json_build_object(
                'id', mi."id", 'materialId', mi."materialId", 'nomeMaterial', mi."nomeMaterial",
                'qtdUsada', mi."qtdUsada", 'custoUnit', mi."custoUnit"
              )), '[]') FROM "PrecMaterialItem" mi WHERE mi."variacaoId" = v."id"
            ),
            'kitItens', (
              SELECT COALESCE(json_agg(json_build_object(
                'id', ki."id", 'produtoId', ki."produtoId", 'nomeProduto', ki."nomeProduto",
                'qtdItens', ki."qtdItens", 'custoUnit', ki."custoUnit"
              )), '[]') FROM "PrecKitItem" ki WHERE ki."variacaoId" = v."id"
            )
          ) ORDER BY v."qtdKit" ASC
        ) FILTER (WHERE v."id" IS NOT NULL), '[]') AS variacoes
      FROM "PrecProduto" p
      LEFT JOIN "PrecVariacao" v ON v."produtoId" = p."id"
      WHERE p."workspaceId" = ${workspaceId} AND p."ativo" = true
      GROUP BY p."id"
      ORDER BY p."nome" ASC
    ` as any[]
    return NextResponse.json(produtos)
  } catch (error) {
    console.error('[GET produtos]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    
    const body = await req.json()
    const { nome, sku, categoria } = body
    
    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    
    const workspaceId = session.user.workspaceId
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    
    await prisma.$executeRaw`
      INSERT INTO "PrecProduto" ("id","workspaceId","nome","sku","categoria","ativo","createdAt","updatedAt")
      VALUES (${id}, ${workspaceId}, ${nome}, ${sku||null}, ${categoria||null}, true, NOW(), NOW())
    `
    return NextResponse.json({ id })
  } catch (error) {
    console.error('[POST produtos]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
