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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId
    const body = await req.json()

    // Montar SET dinâmico com apenas os campos enviados
    const updates: string[] = []

    if (body.nome !== undefined)
      await prisma.$executeRaw`UPDATE "PedidoCampoConfig" SET "nome" = ${body.nome} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`

    if (body.tipo !== undefined)
      await prisma.$executeRaw`UPDATE "PedidoCampoConfig" SET "tipo" = ${body.tipo} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`

    if (body.opcoes !== undefined) {
      const opcoesJson = body.opcoes ? JSON.stringify(body.opcoes) : null
      await prisma.$executeRaw`UPDATE "PedidoCampoConfig" SET "opcoes" = ${opcoesJson} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    }

    if (body.placeholder !== undefined)
      await prisma.$executeRaw`UPDATE "PedidoCampoConfig" SET "placeholder" = ${body.placeholder ?? null} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`

    if (body.usarComoFiltro !== undefined)
      await prisma.$executeRaw`UPDATE "PedidoCampoConfig" SET "usarComoFiltro" = ${body.usarComoFiltro} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`

    if (body.usarNaMassa !== undefined)
      await prisma.$executeRaw`UPDATE "PedidoCampoConfig" SET "usarNaMassa" = ${body.usarNaMassa} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`

    if (body.ativo !== undefined)
      await prisma.$executeRaw`UPDATE "PedidoCampoConfig" SET "ativo" = ${body.ativo} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`

    if (body.ordem !== undefined)
      await prisma.$executeRaw`UPDATE "PedidoCampoConfig" SET "ordem" = ${body.ordem} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`

    // Retornar campo atualizado
    const [campo] = await prisma.$queryRaw`
      SELECT * FROM "PedidoCampoConfig"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    return NextResponse.json(serialize({ campo }))
  } catch (error) {
    console.error('PUT /api/config/campos-pedido/[id]:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    await prisma.$executeRaw`
      DELETE FROM "PedidoCampoConfig"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/config/campos-pedido/[id]:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
