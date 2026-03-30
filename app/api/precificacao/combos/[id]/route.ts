// app/api/precificacao/combos/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { id } = await params
    const workspaceId = session.user.workspaceId
    const { nome, descricao, canal, subOpcao, precoNormal, descontoPct, precoCombo, items } = await req.json()
    await prisma.$executeRaw`
      UPDATE "PrecCombo" SET "nome"=${nome}, "descricao"=${descricao||null},
        "canal"=${canal||'shopee'}, "subOpcao"=${subOpcao||'classico'},
        "precoNormal"=${precoNormal?Number(precoNormal):null},
        "descontoPct"=${descontoPct?Number(descontoPct):null},
        "precoCombo"=${precoCombo?Number(precoCombo):null}
      WHERE "id"=${id} AND "workspaceId"=${workspaceId}
    `
    await prisma.$executeRaw`DELETE FROM "PrecComboItem" WHERE "comboId"=${id}`
    if (Array.isArray(items)) {
      for (const item of items) {
        const iid = Math.random().toString(36).slice(2) + Date.now().toString(36)
        await prisma.$executeRaw`
          INSERT INTO "PrecComboItem" ("id","comboId","variacaoId","nomeProduto","qtd","custoUnit")
          VALUES (${iid}, ${id}, ${item.variacaoId}, ${item.nomeProduto||''}, ${Number(item.qtd||1)}, ${Number(item.custoUnit||0)})
        `
      }
    }
    return NextResponse.json({ ok: true })
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { id } = await params
    const workspaceId = session.user.workspaceId
    await prisma.$executeRaw`UPDATE "PrecCombo" SET "ativo"=false WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
    return NextResponse.json({ ok: true })
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}
