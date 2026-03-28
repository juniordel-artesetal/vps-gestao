import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PUT — renomear ou ativar/desativar setor
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const workspaceId = session.user.workspaceId

    // Verifica se o setor pertence ao workspace
    const setores = await prisma.$queryRaw`
      SELECT id FROM "SetorConfig"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!setores.length) {
      return NextResponse.json({ error: 'Setor não encontrado' }, { status: 404 })
    }

    // Atualiza nome
    if (body.nome !== undefined) {
      await prisma.$executeRaw`
        UPDATE "SetorConfig" SET "nome" = ${body.nome} WHERE "id" = ${id}
      `
    }

    // Atualiza ativo
    if (body.ativo !== undefined) {
      await prisma.$executeRaw`
        UPDATE "SetorConfig" SET "ativo" = ${body.ativo} WHERE "id" = ${id}
      `
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE — remove setor
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    await prisma.$executeRaw`
      DELETE FROM "SetorConfig"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
