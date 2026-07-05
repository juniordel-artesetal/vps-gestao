import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
function novoId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// POST — atribui etiqueta ao card (idempotente)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { id } = await params
  const ws = session.user.workspaceId
  const { etiquetaId } = await req.json()
  if (!etiquetaId) return NextResponse.json({ error: 'etiquetaId obrigatório' }, { status: 400 })

  // Confirma tarefa e etiqueta do mesmo workspace
  const t = await prisma.$queryRaw`SELECT "id" FROM "Tarefa" WHERE "id"=${id} AND "workspaceId"=${ws} LIMIT 1` as any[]
  const e = await prisma.$queryRaw`SELECT "nome" FROM "TarefaEtiqueta" WHERE "id"=${etiquetaId} AND "workspaceId"=${ws} LIMIT 1` as any[]
  if (!t.length || !e.length) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  await prisma.$executeRaw`
    INSERT INTO "TarefaEtiquetaLink" ("id","tarefaId","etiquetaId","workspaceId")
    VALUES (${novoId()}, ${id}, ${etiquetaId}, ${ws})
    ON CONFLICT ("tarefaId","etiquetaId") DO NOTHING
  `
  const usuario = session.user.name || session.user.email || 'Usuária'
  await prisma.$executeRaw`
    INSERT INTO "TarefaHistorico" ("id","tarefaId","workspaceId","tipo","descricao","usuarioNome","createdAt")
    VALUES (${novoId()}, ${id}, ${ws}, 'etiqueta', ${'Etiqueta adicionada: ' + e[0].nome}, ${usuario}, NOW())
  `
  return NextResponse.json({ ok: true })
}

// DELETE ?etiquetaId= — remove etiqueta do card
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { id } = await params
  const ws = session.user.workspaceId
  const etiquetaId = new URL(req.url).searchParams.get('etiquetaId')
  if (!etiquetaId) return NextResponse.json({ error: 'etiquetaId obrigatório' }, { status: 400 })
  await prisma.$executeRaw`DELETE FROM "TarefaEtiquetaLink" WHERE "tarefaId"=${id} AND "etiquetaId"=${etiquetaId} AND "workspaceId"=${ws}`
  return NextResponse.json({ ok: true })
}
