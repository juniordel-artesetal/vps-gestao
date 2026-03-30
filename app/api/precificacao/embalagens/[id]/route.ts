// app/api/precificacao/embalagens/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { id } = await params
    const workspaceId = session.user.workspaceId
    const { nome, descricao, itens = [] } = await req.json()
    const custoTotal = itens.reduce((s: number, item: any) => {
      const rend = Math.max(Number(item.rendimento) || 1, 0.0001)
      return s + (Number(item.qtdUsada) * Number(item.custoUnit)) / rend
    }, 0)
    await prisma.$executeRaw`
      UPDATE "PrecEmbalagem"
      SET "nome"=${nome}, "descricao"=${descricao||null}, "custoTotal"=${custoTotal}, "updatedAt"=NOW()
      WHERE "id"=${id} AND "workspaceId"=${workspaceId}
    `
    await prisma.$executeRaw`DELETE FROM "PrecEmbalagemItem" WHERE "embalagemId"=${id}`
    for (const item of itens) {
      const itemId = Math.random().toString(36).slice(2) + Date.now().toString(36)
      const rend   = Math.max(Number(item.rendimento) || 1, 0.0001)
      await prisma.$executeRaw`
        INSERT INTO "PrecEmbalagemItem" ("id","embalagemId","materialId","nomeMaterial","qtdUsada","custoUnit","rendimento")
        VALUES (${itemId}, ${id}, ${item.materialId||null}, ${item.nomeMaterial}, ${Number(item.qtdUsada)}, ${Number(item.custoUnit)}, ${rend})
      `
    }
    return NextResponse.json({ ok: true, custoTotal })
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { id } = await params
    const workspaceId = session.user.workspaceId
    await prisma.$executeRaw`UPDATE "PrecEmbalagem" SET "ativo"=false WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
    return NextResponse.json({ ok: true })
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}
