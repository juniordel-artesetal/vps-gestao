import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    const workspaceId = session.user.workspaceId

    if (body.nome !== undefined)
      await prisma.$executeRaw`UPDATE "PedidoCampoConfig" SET "nome" = ${body.nome} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (body.ativo !== undefined)
      await prisma.$executeRaw`UPDATE "PedidoCampoConfig" SET "ativo" = ${body.ativo} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (body.usarComoFiltro !== undefined)
      await prisma.$executeRaw`UPDATE "PedidoCampoConfig" SET "usarComoFiltro" = ${body.usarComoFiltro} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (body.usarNaMassa !== undefined)
      await prisma.$executeRaw`UPDATE "PedidoCampoConfig" SET "usarNaMassa" = ${body.usarNaMassa} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (body.opcoes !== undefined) {
      const opcoesJson = body.opcoes ? JSON.stringify(body.opcoes) : null
      await prisma.$executeRaw`UPDATE "PedidoCampoConfig" SET "opcoes" = ${opcoesJson} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    }
    if (body.ordem !== undefined)
      await prisma.$executeRaw`UPDATE "PedidoCampoConfig" SET "ordem" = ${body.ordem} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    await prisma.$executeRaw`
      DELETE FROM "PedidoCampoConfig" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
