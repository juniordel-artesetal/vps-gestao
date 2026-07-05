import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
function novoId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// POST — cria uma checklist no card
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { id } = await params
  const ws = session.user.workspaceId
  const { titulo } = await req.json()

  const t = await prisma.$queryRaw`SELECT "id" FROM "Tarefa" WHERE "id"=${id} AND "workspaceId"=${ws} LIMIT 1` as any[]
  if (!t.length) return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })

  const [{ maxOrdem }] = await prisma.$queryRaw`SELECT COALESCE(MAX("ordem"),-1)::int AS "maxOrdem" FROM "TarefaChecklist" WHERE "tarefaId"=${id} AND "workspaceId"=${ws}` as any[]
  const clId = novoId()
  await prisma.$executeRaw`
    INSERT INTO "TarefaChecklist" ("id","tarefaId","workspaceId","titulo","ordem")
    VALUES (${clId}, ${id}, ${ws}, ${titulo?.trim() || 'Checklist'}, ${Number(maxOrdem) + 1})
  `
  const usuario = session.user.name || session.user.email || 'Usuária'
  await prisma.$executeRaw`
    INSERT INTO "TarefaHistorico" ("id","tarefaId","workspaceId","tipo","descricao","usuarioNome","createdAt")
    VALUES (${novoId()}, ${id}, ${ws}, 'checklist', 'Checklist adicionada', ${usuario}, NOW())
  `
  return NextResponse.json({ ok: true, id: clId })
}
