import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — busca pedido por ID
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    const pedidos = await prisma.$queryRaw`
      SELECT o.*,
        (SELECT COUNT(*) FROM "WorkItem" wi WHERE wi."orderId" = o."id") as total_itens,
        (SELECT COUNT(*) FROM "WorkItem" wi WHERE wi."orderId" = o."id" AND wi."status" = 'CONCLUIDO') as itens_concluidos
      FROM "Order" o
      WHERE o."id" = ${id} AND o."workspaceId" = ${workspaceId}
    ` as any[]

    if (!pedidos.length) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

    // Busca work items do pedido
    const workItems = await prisma.$queryRaw`
      SELECT wi.*, s."nome" as setor_nome
      FROM "WorkItem" wi
      LEFT JOIN "SetorConfig" s ON s."id" = wi."setorId"
      WHERE wi."orderId" = ${id}
      ORDER BY s."ordem" ASC
    ` as any[]

    return NextResponse.json({ pedido: pedidos[0], workItems })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PUT — atualiza pedido
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    const workspaceId = session.user.workspaceId

    const pedidos = await prisma.$queryRaw`
      SELECT id FROM "Order" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!pedidos.length) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

    const fields = [
      'numero', 'destinatario', 'idCliente', 'canal', 'produto',
      'quantidade', 'valor', 'dataEntrada', 'dataEnvio',
      'observacoes', 'prioridade', 'status',
    ]

    for (const field of fields) {
      if (body[field] !== undefined) {
        await prisma.$executeRaw`
          UPDATE "Order" SET ${prisma.$raw(`"${field}"`)} = ${body[field]}, "updatedAt" = NOW()
          WHERE "id" = ${id}
        `
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE — cancela pedido
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    await prisma.$executeRaw`
      UPDATE "Order" SET "status" = 'CANCELADO', "updatedAt" = NOW()
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
