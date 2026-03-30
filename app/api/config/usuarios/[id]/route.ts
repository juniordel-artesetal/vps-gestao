import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ── PUT — alterar role ou ativo de um usuário
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { id } = await params
  const workspaceId = session.user.workspaceId

  // Impede que o ADMIN altere a si mesmo
  if (id === session.user.id) {
    return NextResponse.json({ error: 'Você não pode alterar sua própria conta' }, { status: 400 })
  }

  // Verificar se o usuário pertence ao workspace
  const usuarios = await prisma.$queryRaw`
    SELECT id FROM "User"
    WHERE "id" = ${id}
    AND "workspaceId" = ${workspaceId}
    LIMIT 1
  ` as any[]

  if (!usuarios.length) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  const body = await req.json()

  // Alterar role
  if (body.role !== undefined) {
    if (!['ADMIN', 'DELEGADOR', 'OPERADOR'].includes(body.role)) {
      return NextResponse.json({ error: 'Perfil inválido' }, { status: 400 })
    }
    await prisma.$executeRaw`
      UPDATE "User" SET "role" = ${body.role} WHERE "id" = ${id}
    `
  }

  // Alterar ativo
  if (body.ativo !== undefined) {
    await prisma.$executeRaw`
      UPDATE "User" SET "ativo" = ${body.ativo} WHERE "id" = ${id}
    `
  }

  return NextResponse.json({ ok: true })
}
