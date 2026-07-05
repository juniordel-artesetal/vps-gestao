import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// PUT — atualiza coleção (nome, ordem, ativo)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId
  const { nome, ordem, ativo } = await req.json()

  if (nome !== undefined && String(nome).trim())
    await prisma.$executeRaw`UPDATE "LojaColecao" SET "nome"=${String(nome).trim()} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
  if (ordem !== undefined)
    await prisma.$executeRaw`UPDATE "LojaColecao" SET "ordem"=${Number(ordem) || 0} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
  if (ativo !== undefined)
    await prisma.$executeRaw`UPDATE "LojaColecao" SET "ativo"=${Boolean(ativo)} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`

  return NextResponse.json({ ok: true })
}

// DELETE — remove coleção (produtos vinculados voltam a "sem coleção")
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId

  // Desvincula produtos desta coleção (isolado por workspace)
  await prisma.$executeRaw`
    UPDATE "PrecProduto" SET "lojaColecaoId" = NULL
    WHERE "lojaColecaoId" = ${id} AND "workspaceId" = ${workspaceId}
  `
  await prisma.$executeRaw`
    DELETE FROM "LojaColecao" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
  `
  return NextResponse.json({ ok: true })
}
