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
  const { texto, mencionados } = await req.json()
  if (!texto?.trim()) return NextResponse.json({ error: 'Comentário vazio' }, { status: 400 })

  const [t] = await prisma.$queryRaw`SELECT "id","quadroId","titulo" FROM "Tarefa" WHERE "id"=${id} AND "workspaceId"=${workspaceId} LIMIT 1` as any[]
  if (!t) return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })

  const autorNome = session.user.name || session.user.email || 'Usuária'
  const comId = novoId()
  await prisma.$executeRaw`
    INSERT INTO "TarefaComentario" ("id","tarefaId","workspaceId","autorId","autorNome","texto","createdAt")
    VALUES (${comId}, ${id}, ${workspaceId}, ${session.user.id || null}, ${autorNome}, ${String(texto).trim().slice(0, 2000)}, NOW())
  `
  await prisma.$executeRaw`
    INSERT INTO "TarefaHistorico" ("id","tarefaId","workspaceId","tipo","descricao","usuarioNome","createdAt")
    VALUES (${novoId()}, ${id}, ${workspaceId}, 'comentario', 'Comentou', ${autorNome}, NOW())
  `

  // ── Menções: só usuários do MESMO workspace; notifica via Notificacao (sino) ──
  const ids = Array.isArray(mencionados) ? [...new Set(mencionados.map((x: any) => String(x)))].filter(Boolean) : []
  if (ids.length > 0) {
    const validos = await prisma.$queryRaw`
      SELECT "id","nome" FROM "User"
      WHERE "workspaceId" = ${workspaceId} AND "id" = ANY(${ids}::text[])
    ` as { id: string; nome: string }[]
    const href = `/tarefas/quadros/${t.quadroId}`
    for (const u of validos) {
      if (u.id === session.user.id) continue // não notifica a si mesmo
      await prisma.$executeRaw`
        INSERT INTO "Notificacao" ("id","workspaceId","userId","tipo","titulo","mensagem","href","lida","createdAt")
        VALUES (${novoId()}, ${workspaceId}, ${u.id}, 'mencao', ${autorNome + ' mencionou você'}, ${`Na tarefa "${t.titulo}"`}, ${href}, false, NOW())
      `
    }
  }
  return NextResponse.json({ ok: true, id: comId, autorNome })
}
