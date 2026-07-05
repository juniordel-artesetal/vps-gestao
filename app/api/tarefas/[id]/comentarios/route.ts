import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
function novoId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// POST — adiciona comentário ao card
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const workspaceId = session.user.workspaceId
  const { texto } = await req.json()
  if (!texto?.trim()) return NextResponse.json({ error: 'Comentário vazio' }, { status: 400 })

  const t = await prisma.$queryRaw`SELECT "id" FROM "Tarefa" WHERE "id"=${id} AND "workspaceId"=${workspaceId} LIMIT 1` as any[]
  if (!t.length) return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })

  const autorNome = session.user.name || session.user.email || 'Usuária'
  const comId = novoId()
  await prisma.$executeRaw`
    INSERT INTO "TarefaComentario" ("id","tarefaId","workspaceId","autorId","autorNome","texto","createdAt")
    VALUES (${comId}, ${id}, ${workspaceId}, ${session.user.id || null}, ${autorNome}, ${String(texto).trim().slice(0, 2000)}, NOW())
  `
  return NextResponse.json({ ok: true, id: comId, autorNome })
}
