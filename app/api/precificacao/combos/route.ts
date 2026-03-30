// app/api/precificacao/combos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const workspaceId = session.user.workspaceId
    const combos = await prisma.$queryRaw`
      SELECT c.*,
        COALESCE(JSON_AGG(
          JSON_BUILD_OBJECT('id',ci."id",'variacaoId',ci."variacaoId",'nomeProduto',ci."nomeProduto",'qtd',ci."qtd",'custoUnit',ci."custoUnit")
        ) FILTER (WHERE ci."id" IS NOT NULL), '[]') as items
      FROM "PrecCombo" c
      LEFT JOIN "PrecComboItem" ci ON ci."comboId" = c."id"
      WHERE c."workspaceId" = ${workspaceId} AND c."ativo" = true
      GROUP BY c."id"
      ORDER BY c."createdAt" DESC
    ` as any[]
    return NextResponse.json(combos)
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { nome, descricao, canal, subOpcao, precoNormal, descontoPct, precoCombo, items } = await req.json()
    if (!nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
    const workspaceId = session.user.workspaceId
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    await prisma.$executeRaw`
      INSERT INTO "PrecCombo" ("id","workspaceId","nome","descricao","canal","subOpcao","precoNormal","descontoPct","precoCombo")
      VALUES (${id}, ${workspaceId}, ${nome}, ${descricao||null}, ${canal||'shopee'}, ${subOpcao||'classico'},
        ${precoNormal?Number(precoNormal):null}, ${descontoPct?Number(descontoPct):null}, ${precoCombo?Number(precoCombo):null})
    `
    if (Array.isArray(items)) {
      for (const item of items) {
        const iid = Math.random().toString(36).slice(2) + Date.now().toString(36)
        await prisma.$executeRaw`
          INSERT INTO "PrecComboItem" ("id","comboId","variacaoId","nomeProduto","qtd","custoUnit")
          VALUES (${iid}, ${id}, ${item.variacaoId}, ${item.nomeProduto||''}, ${Number(item.qtd||1)}, ${Number(item.custoUnit||0)})
        `
      }
    }
    return NextResponse.json({ id })
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}
