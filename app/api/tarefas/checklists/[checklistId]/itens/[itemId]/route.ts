import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// PUT — marca/desmarca ou renomeia o item
export async function PUT(req: Request, { params }: { params: Promise<{ checklistId: string; itemId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { checklistId, itemId } = await params
  const ws = session.user.workspaceId
  const b = await req.json()
  if (b.concluido !== undefined)
    await prisma.$executeRaw`UPDATE "TarefaChecklistItem" SET "concluido"=${Boolean(b.concluido)} WHERE "id"=${itemId} AND "checklistId"=${checklistId} AND "workspaceId"=${ws}`
  if (b.texto !== undefined && String(b.texto).trim())
    await prisma.$executeRaw`UPDATE "TarefaChecklistItem" SET "texto"=${String(b.texto).trim()} WHERE "id"=${itemId} AND "checklistId"=${checklistId} AND "workspaceId"=${ws}`
  return NextResponse.json({ ok: true })
}

// DELETE — remove o item
export async function DELETE(_req: Request, { params }: { params: Promise<{ checklistId: string; itemId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { checklistId, itemId } = await params
  const ws = session.user.workspaceId
  await prisma.$executeRaw`DELETE FROM "TarefaChecklistItem" WHERE "id"=${itemId} AND "checklistId"=${checklistId} AND "workspaceId"=${ws}`
  return NextResponse.json({ ok: true })
}
