import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}
function novoId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }
const PRIORIDADES = ['baixa', 'normal', 'alta', 'urgente']

// GET — detalhe do card (SEM imagens: só ids/nomes dos anexos)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const workspaceId = session.user.workspaceId

  const [tarefa] = await prisma.$queryRaw`
    SELECT t."id", t."quadroId", t."colunaId", t."titulo", t."descricao", t."clienteId", t."responsavelId",
           TO_CHAR(t."prazo", 'YYYY-MM-DD') AS "prazo", t."prioridade", t."createdAt", t."updatedAt",
           c."nome" AS "clienteNome", u."nome" AS "responsavelNome"
    FROM "Tarefa" t
    LEFT JOIN "Cliente" c ON c."id" = t."clienteId"
    LEFT JOIN "User" u ON u."id" = t."responsavelId"
    WHERE t."id"=${id} AND t."workspaceId"=${workspaceId} LIMIT 1
  ` as any[]
  if (!tarefa) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

  const anexos = await prisma.$queryRaw`
    SELECT "id","nome","createdAt" FROM "TarefaAnexo" WHERE "tarefaId"=${id} AND "workspaceId"=${workspaceId} ORDER BY "createdAt" ASC
  ` as any[]
  const comentarios = await prisma.$queryRaw`
    SELECT "id","autorNome","texto","createdAt" FROM "TarefaComentario" WHERE "tarefaId"=${id} AND "workspaceId"=${workspaceId} ORDER BY "createdAt" ASC
  ` as any[]
  const historico = await prisma.$queryRaw`
    SELECT "id","tipo","descricao","usuarioNome","createdAt" FROM "TarefaHistorico" WHERE "tarefaId"=${id} AND "workspaceId"=${workspaceId} ORDER BY "createdAt" DESC LIMIT 50
  ` as any[]
  const etiquetas = await prisma.$queryRaw`
    SELECT e."id", e."nome", e."cor" FROM "TarefaEtiquetaLink" l
    JOIN "TarefaEtiqueta" e ON e."id" = l."etiquetaId"
    WHERE l."tarefaId"=${id} AND l."workspaceId"=${workspaceId} ORDER BY e."nome" ASC
  ` as any[]
  const checklists = await prisma.$queryRaw`
    SELECT "id","titulo","ordem" FROM "TarefaChecklist" WHERE "tarefaId"=${id} AND "workspaceId"=${workspaceId} ORDER BY "ordem" ASC
  ` as any[]
  for (const cl of checklists) {
    cl.itens = await prisma.$queryRaw`
      SELECT "id","texto","concluido","ordem" FROM "TarefaChecklistItem" WHERE "checklistId"=${cl.id} AND "workspaceId"=${workspaceId} ORDER BY "ordem" ASC
    ` as any[]
  }

  return NextResponse.json(serialize({ ...tarefa, anexos, comentarios, historico, etiquetas, checklists }))
}

// PUT — edita o card (registra histórico de prazo/prioridade)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const workspaceId = session.user.workspaceId
  const b = await req.json()

  const [atual] = await prisma.$queryRaw`
    SELECT TO_CHAR("prazo",'YYYY-MM-DD') AS "prazo", "prioridade" FROM "Tarefa" WHERE "id"=${id} AND "workspaceId"=${workspaceId} LIMIT 1
  ` as any[]
  if (!atual) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

  if (b.titulo !== undefined && String(b.titulo).trim())
    await prisma.$executeRaw`UPDATE "Tarefa" SET "titulo"=${String(b.titulo).trim()} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
  if (b.descricao !== undefined)
    await prisma.$executeRaw`UPDATE "Tarefa" SET "descricao"=${b.descricao || null} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
  if (b.clienteId !== undefined)
    await prisma.$executeRaw`UPDATE "Tarefa" SET "clienteId"=${b.clienteId || null} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
  if (b.responsavelId !== undefined)
    await prisma.$executeRaw`UPDATE "Tarefa" SET "responsavelId"=${b.responsavelId || null} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
  if (b.prazo !== undefined)
    await prisma.$executeRaw`UPDATE "Tarefa" SET "prazo"=${b.prazo ? new Date(String(b.prazo)) : null} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
  if (b.prioridade !== undefined && PRIORIDADES.includes(b.prioridade))
    await prisma.$executeRaw`UPDATE "Tarefa" SET "prioridade"=${b.prioridade} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
  await prisma.$executeRaw`UPDATE "Tarefa" SET "updatedAt"=NOW() WHERE "id"=${id} AND "workspaceId"=${workspaceId}`

  // Histórico de mudanças relevantes
  const usuario = session.user.name || session.user.email || 'Usuária'
  const eventos: string[] = []
  if (b.prazo !== undefined && (b.prazo || null) !== (atual.prazo || null)) eventos.push(b.prazo ? `Prazo definido para ${b.prazo}` : 'Prazo removido')
  if (b.prioridade !== undefined && PRIORIDADES.includes(b.prioridade) && b.prioridade !== atual.prioridade) eventos.push(`Prioridade: ${b.prioridade}`)
  for (const ev of eventos) {
    await prisma.$executeRaw`
      INSERT INTO "TarefaHistorico" ("id","tarefaId","workspaceId","tipo","descricao","usuarioNome","createdAt")
      VALUES (${novoId()}, ${id}, ${workspaceId}, 'editada', ${ev}, ${usuario}, NOW())
    `
  }
  return NextResponse.json({ ok: true })
}

// DELETE — remove o card e seus anexos/comentários/histórico
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const workspaceId = session.user.workspaceId

  await prisma.$executeRaw`DELETE FROM "TarefaAnexo" WHERE "tarefaId"=${id} AND "workspaceId"=${workspaceId}`
  await prisma.$executeRaw`DELETE FROM "TarefaComentario" WHERE "tarefaId"=${id} AND "workspaceId"=${workspaceId}`
  await prisma.$executeRaw`DELETE FROM "TarefaHistorico" WHERE "tarefaId"=${id} AND "workspaceId"=${workspaceId}`
  await prisma.$executeRaw`DELETE FROM "Tarefa" WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
  return NextResponse.json({ ok: true })
}
