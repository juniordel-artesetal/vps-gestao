import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
function novoId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// POST — anexa uma imagem (base64 comprimido) ao card
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const workspaceId = session.user.workspaceId
  const { imagem, nome } = await req.json()
  if (!imagem || !String(imagem).startsWith('data:image')) return NextResponse.json({ error: 'Imagem inválida' }, { status: 400 })

  const t = await prisma.$queryRaw`SELECT "id" FROM "Tarefa" WHERE "id"=${id} AND "workspaceId"=${workspaceId} LIMIT 1` as any[]
  if (!t.length) return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })

  const anexoId = novoId()
  await prisma.$executeRaw`
    INSERT INTO "TarefaAnexo" ("id","tarefaId","workspaceId","imagem","nome","createdAt")
    VALUES (${anexoId}, ${id}, ${workspaceId}, ${String(imagem)}, ${nome ? String(nome).slice(0, 120) : null}, NOW())
  `
  return NextResponse.json({ ok: true, id: anexoId })
}
