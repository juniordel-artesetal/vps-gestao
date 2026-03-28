import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PUT — atualiza campo
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    const workspaceId = session.user.workspaceId

    const campos = await prisma.$queryRaw`
      SELECT id FROM "SetorCampo"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!campos.length) return NextResponse.json({ error: 'Campo não encontrado' }, { status: 404 })

    if (body.nome !== undefined) {
      await prisma.$executeRaw`UPDATE "SetorCampo" SET "nome" = ${body.nome} WHERE "id" = ${id}`
    }
    if (body.obrigatorio !== undefined) {
      await prisma.$executeRaw`UPDATE "SetorCampo" SET "obrigatorio" = ${body.obrigatorio} WHERE "id" = ${id}`
    }
    if (body.placeholder !== undefined) {
      await prisma.$executeRaw`UPDATE "SetorCampo" SET "placeholder" = ${body.placeholder} WHERE "id" = ${id}`
    }
    if (body.opcoes !== undefined) {
      const opcoesJson = body.opcoes ? JSON.stringify(body.opcoes) : null
      await prisma.$executeRaw`UPDATE "SetorCampo" SET "opcoes" = ${opcoesJson} WHERE "id" = ${id}`
    }
    if (body.ativo !== undefined) {
      await prisma.$executeRaw`UPDATE "SetorCampo" SET "ativo" = ${body.ativo} WHERE "id" = ${id}`
    }
    if (body.ordem !== undefined) {
      await prisma.$executeRaw`UPDATE "SetorCampo" SET "ordem" = ${body.ordem} WHERE "id" = ${id}`
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE — remove campo
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    await prisma.$executeRaw`
      DELETE FROM "SetorCampo"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
