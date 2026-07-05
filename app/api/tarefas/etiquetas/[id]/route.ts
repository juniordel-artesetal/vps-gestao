import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// PUT — edita etiqueta (nome/cor)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { id } = await params
  const ws = session.user.workspaceId
  const { nome, cor } = await req.json()
  if (nome !== undefined && String(nome).trim())
    await prisma.$executeRaw`UPDATE "TarefaEtiqueta" SET "nome"=${String(nome).trim()} WHERE "id"=${id} AND "workspaceId"=${ws}`
  if (cor !== undefined)
    await prisma.$executeRaw`UPDATE "TarefaEtiqueta" SET "cor"=${cor || '#f97316'} WHERE "id"=${id} AND "workspaceId"=${ws}`
  return NextResponse.json({ ok: true })
}

// DELETE — remove etiqueta + seus vínculos
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { id } = await params
  const ws = session.user.workspaceId
  await prisma.$executeRaw`DELETE FROM "TarefaEtiquetaLink" WHERE "etiquetaId"=${id} AND "workspaceId"=${ws}`
  await prisma.$executeRaw`DELETE FROM "TarefaEtiqueta" WHERE "id"=${id} AND "workspaceId"=${ws}`
  return NextResponse.json({ ok: true })
}
