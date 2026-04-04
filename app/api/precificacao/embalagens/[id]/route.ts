import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    const rows = await prisma.$queryRaw`
      SELECT * FROM "PrecEmbalagem"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!rows.length) return NextResponse.json({ error: 'Embalagem não encontrada' }, { status: 404 })

    const itens = await prisma.$queryRaw`
      SELECT * FROM "PrecEmbalagemItem"
      WHERE "embalagemId" = ${id}
      ORDER BY "id" ASC
    ` as any[]

    return NextResponse.json(serialize({ ...rows[0], itens }))
  } catch (e) {
    console.error('GET /api/precificacao/embalagens/[id]:', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId
    const body = await req.json()
    const { nome, descricao, ativo, itens } = body

    // Verifica pertencimento ao workspace
    const exists = await prisma.$queryRaw`
      SELECT id FROM "PrecEmbalagem"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!exists.length) return NextResponse.json({ error: 'Embalagem não encontrada' }, { status: 404 })

    // Atualiza campos base
    await prisma.$executeRaw`
      UPDATE "PrecEmbalagem" SET
        "nome"      = COALESCE(${nome      ?? null}, "nome"),
        "descricao" = COALESCE(${descricao ?? null}, "descricao"),
        "ativo"     = COALESCE(${ativo     != null ? Boolean(ativo) : null}, "ativo"),
        "updatedAt" = NOW()
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `

    // Regravar itens se enviados
    if (Array.isArray(itens)) {
      // Remove itens antigos
      await prisma.$executeRaw`
        DELETE FROM "PrecEmbalagemItem" WHERE "embalagemId" = ${id}
      `

      let custoTotal = 0

      // Reinsere itens novos
      for (const item of itens) {
        const itemId       = gerarId()
        const qtdUsada     = parseFloat(String(item.qtdUsada   ?? 1))
        const rendimento   = parseFloat(String(item.rendimento ?? 1))
        const custoUnit    = parseFloat(String(item.custoUnit  ?? 0))
        // Custo do item = (custo unitário do material × qtd usada) ÷ rendimento
        const custoItem    = rendimento > 0 ? (custoUnit * qtdUsada) / rendimento : 0
        custoTotal        += custoItem

        await prisma.$executeRaw`
          INSERT INTO "PrecEmbalagemItem"
            ("id", "embalagemId", "materialId", "nomeMaterial", "qtdUsada", "custoUnit", "rendimento")
          VALUES
            (${itemId}, ${id}, ${item.materialId ?? null}, ${item.nomeMaterial ?? ''}, ${qtdUsada}, ${custoUnit}, ${rendimento})
        `
      }

      // Atualiza custo total calculado
      await prisma.$executeRaw`
        UPDATE "PrecEmbalagem" SET "custoTotal" = ${custoTotal}
        WHERE "id" = ${id}
      `
    }

    // Retorna embalagem atualizada com itens
    const updated = await prisma.$queryRaw`
      SELECT * FROM "PrecEmbalagem" WHERE "id" = ${id}
    ` as any[]

    const itensAtualizados = await prisma.$queryRaw`
      SELECT * FROM "PrecEmbalagemItem" WHERE "embalagemId" = ${id} ORDER BY "id" ASC
    ` as any[]

    return NextResponse.json(serialize({ ...updated[0], itens: itensAtualizados }))
  } catch (e) {
    console.error('PUT /api/precificacao/embalagens/[id]:', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    // Verifica pertencimento ao workspace
    const exists = await prisma.$queryRaw`
      SELECT id FROM "PrecEmbalagem"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!exists.length) return NextResponse.json({ error: 'Embalagem não encontrada' }, { status: 404 })

    // Remove itens de composição primeiro
    await prisma.$executeRaw`
      DELETE FROM "PrecEmbalagemItem" WHERE "embalagemId" = ${id}
    `

    // Remove a embalagem
    await prisma.$executeRaw`
      DELETE FROM "PrecEmbalagem"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/precificacao/embalagens/[id]:', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
