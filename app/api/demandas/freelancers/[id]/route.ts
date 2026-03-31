import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { id } = await params
  const workspaceId = session.user.workspaceId
  const body = await req.json()

  const { nome, telefone, pix, especialidade, observacoes, ativo } = body

  if (nome !== undefined)
    await prisma.$executeRaw`UPDATE "Freelancer" SET "nome" = ${nome.trim()} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  if (telefone !== undefined)
    await prisma.$executeRaw`UPDATE "Freelancer" SET "telefone" = ${telefone || null} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  if (pix !== undefined)
    await prisma.$executeRaw`UPDATE "Freelancer" SET "pix" = ${pix || null} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  if (especialidade !== undefined)
    await prisma.$executeRaw`UPDATE "Freelancer" SET "especialidade" = ${especialidade || null} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  if (observacoes !== undefined)
    await prisma.$executeRaw`UPDATE "Freelancer" SET "observacoes" = ${observacoes || null} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  if (ativo !== undefined)
    await prisma.$executeRaw`UPDATE "Freelancer" SET "ativo" = ${Boolean(ativo)} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { id } = await params
  const workspaceId = session.user.workspaceId
  await prisma.$executeRaw`DELETE FROM "Freelancer" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  return NextResponse.json({ ok: true })
}
