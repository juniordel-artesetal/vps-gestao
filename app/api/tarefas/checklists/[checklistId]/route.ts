import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
function novoId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// PUT — renomeia a checklist
export async function PUT(req: Request, { params }: { params: Promise<{ checklistId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { checklistId } = await params
  const ws = session.user.workspaceId
  const { titulo } = await req.json()
  if (titulo?.trim())
    await prisma.$executeRaw`UPDATE "TarefaChecklist" SET "titulo"=${titulo.trim()} WHERE "id"=${checklistId} AND "workspaceId"=${ws}`
  return NextResponse.json({ ok: true })
}

// POST — adiciona item à checklist
export async function POST(req: Request, { params }: { params: Promise<{ checklistId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { checklistId } = await params
  const ws = session.user.workspaceId
  const { texto } = await req.json()
  if (!texto?.trim()) return NextResponse.json({ error: 'Texto obrigatório' }, { status: 400 })

  const cl = await prisma.$queryRaw`SELECT "id" FROM "TarefaChecklist" WHERE "id"=${checklistId} AND "workspaceId"=${ws} LIMIT 1` as any[]
  if (!cl.length) return NextResponse.json({ error: 'Checklist não encontrada' }, { status: 404 })

  const [{ maxOrdem }] = await prisma.$queryRaw`SELECT COALESCE(MAX("ordem"),-1)::int AS "maxOrdem" FROM "TarefaChecklistItem" WHERE "checklistId"=${checklistId} AND "workspaceId"=${ws}` as any[]
  const itemId = novoId()
  await prisma.$executeRaw`
    INSERT INTO "TarefaChecklistItem" ("id","checklistId","workspaceId","texto","concluido","ordem")
    VALUES (${itemId}, ${checklistId}, ${ws}, ${texto.trim()}, false, ${Number(maxOrdem) + 1})
  `
  return NextResponse.json({ ok: true, id: itemId })
}

// DELETE — remove a checklist + itens
export async function DELETE(_req: Request, { params }: { params: Promise<{ checklistId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { checklistId } = await params
  const ws = session.user.workspaceId
  await prisma.$executeRaw`DELETE FROM "TarefaChecklistItem" WHERE "checklistId"=${checklistId} AND "workspaceId"=${ws}`
  await prisma.$executeRaw`DELETE FROM "TarefaChecklist" WHERE "id"=${checklistId} AND "workspaceId"=${ws}`
  return NextResponse.json({ ok: true })
}
