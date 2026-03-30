// app/api/precificacao/embalagens/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const workspaceId = session.user.workspaceId
    const rows: any[] = await prisma.$queryRaw`
      SELECT e.*, e."custoTotal"::float,
        COALESCE(json_agg(
          json_build_object(
            'id', ei."id", 'materialId', ei."materialId", 'nomeMaterial', ei."nomeMaterial",
            'qtdUsada', ei."qtdUsada"::float, 'custoUnit', ei."custoUnit"::float, 'rendimento', ei."rendimento"::float
          ) ORDER BY ei."id"
        ) FILTER (WHERE ei."id" IS NOT NULL), '[]') AS itens
      FROM "PrecEmbalagem" e
      LEFT JOIN "PrecEmbalagemItem" ei ON ei."embalagemId" = e."id"
      WHERE e."workspaceId" = ${workspaceId} AND e."ativo" = true
      GROUP BY e."id"
      ORDER BY e."nome" ASC
    `
    return NextResponse.json(rows)
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { nome, descricao, itens = [] } = await req.json()
    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    const workspaceId = session.user.workspaceId
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    const custoTotal = itens.reduce((s: number, item: any) => {
      const rend = Math.max(Number(item.rendimento) || 1, 0.0001)
      return s + (Number(item.qtdUsada) * Number(item.custoUnit)) / rend
    }, 0)
    await prisma.$executeRaw`
      INSERT INTO "PrecEmbalagem" ("id","workspaceId","nome","descricao","custoTotal","ativo","createdAt","updatedAt")
      VALUES (${id}, ${workspaceId}, ${nome}, ${descricao||null}, ${custoTotal}, true, NOW(), NOW())
    `
    for (const item of itens) {
      const itemId = Math.random().toString(36).slice(2) + Date.now().toString(36)
      const rend   = Math.max(Number(item.rendimento) || 1, 0.0001)
      await prisma.$executeRaw`
        INSERT INTO "PrecEmbalagemItem" ("id","embalagemId","materialId","nomeMaterial","qtdUsada","custoUnit","rendimento")
        VALUES (${itemId}, ${id}, ${item.materialId||null}, ${item.nomeMaterial}, ${Number(item.qtdUsada)}, ${Number(item.custoUnit)}, ${rend})
      `
    }
    return NextResponse.json({ id, custoTotal }, { status: 201 })
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}
