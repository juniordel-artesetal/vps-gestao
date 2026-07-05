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

// GET ?quadroId= — colunas + cards (SEM imagens; só flags/contagens)
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const workspaceId = session.user.workspaceId
  const { searchParams } = new URL(req.url)
  const quadroId = searchParams.get('quadroId')
  if (!quadroId) return NextResponse.json({ error: 'quadroId obrigatório' }, { status: 400 })

  const [quadro] = await prisma.$queryRaw`
    SELECT "id","nome","cor" FROM "TarefaQuadro" WHERE "id"=${quadroId} AND "workspaceId"=${workspaceId} LIMIT 1
  ` as any[]
  if (!quadro) return NextResponse.json({ error: 'Quadro não encontrado' }, { status: 404 })

  const colunas = await prisma.$queryRaw`
    SELECT "id","nome","cor","ordem" FROM "TarefaColuna"
    WHERE "quadroId"=${quadroId} AND "workspaceId"=${workspaceId}
    ORDER BY "ordem" ASC
  ` as any[]

  const tarefas = await prisma.$queryRaw`
    SELECT t."id", t."colunaId", t."titulo", t."descricao", t."clienteId", t."responsavelId",
           TO_CHAR(t."prazo", 'YYYY-MM-DD') AS "prazo", t."prioridade", t."ordem",
           c."nome" AS "clienteNome", u."nome" AS "responsavelNome",
           (SELECT COUNT(*)::int FROM "TarefaAnexo" a WHERE a."tarefaId"=t."id") AS "nAnexos",
           (SELECT COUNT(*)::int FROM "TarefaComentario" cm WHERE cm."tarefaId"=t."id") AS "nComentarios",
           (SELECT COALESCE(json_agg(json_build_object('id', e."id", 'nome', e."nome", 'cor', e."cor")), '[]'::json)
              FROM "TarefaEtiquetaLink" l JOIN "TarefaEtiqueta" e ON e."id"=l."etiquetaId" WHERE l."tarefaId"=t."id") AS "etiquetas",
           (SELECT COUNT(*)::int FROM "TarefaChecklistItem" i JOIN "TarefaChecklist" cl ON cl."id"=i."checklistId" WHERE cl."tarefaId"=t."id") AS "clTotal",
           (SELECT COUNT(*)::int FROM "TarefaChecklistItem" i JOIN "TarefaChecklist" cl ON cl."id"=i."checklistId" WHERE cl."tarefaId"=t."id" AND i."concluido"=true) AS "clFeitos"
    FROM "Tarefa" t
    LEFT JOIN "Cliente" c ON c."id" = t."clienteId"
    LEFT JOIN "User" u ON u."id" = t."responsavelId"
    WHERE t."quadroId"=${quadroId} AND t."workspaceId"=${workspaceId}
    ORDER BY t."colunaId", t."ordem" ASC
  ` as any[]

  return NextResponse.json(serialize({ quadro, colunas, tarefas }))
}

// POST — cria card numa coluna
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const workspaceId = session.user.workspaceId
  const b = await req.json()
  const { quadroId, colunaId, titulo } = b
  if (!quadroId || !colunaId || !titulo?.trim()) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  // Confirma coluna do quadro/workspace
  const col = await prisma.$queryRaw`SELECT "id" FROM "TarefaColuna" WHERE "id"=${colunaId} AND "quadroId"=${quadroId} AND "workspaceId"=${workspaceId} LIMIT 1` as any[]
  if (!col.length) return NextResponse.json({ error: 'Coluna inválida' }, { status: 400 })

  const prioridade = PRIORIDADES.includes(b.prioridade) ? b.prioridade : 'normal'
  const prazo = b.prazo ? String(b.prazo) : null
  const clienteId = b.clienteId || null
  const responsavelId = b.responsavelId || null

  const [{ maxOrdem }] = await prisma.$queryRaw`
    SELECT COALESCE(MAX("ordem"), -1)::int AS "maxOrdem" FROM "Tarefa" WHERE "colunaId"=${colunaId} AND "workspaceId"=${workspaceId}
  ` as any[]

  const id = novoId()
  await prisma.$executeRaw`
    INSERT INTO "Tarefa" ("id","quadroId","colunaId","workspaceId","titulo","descricao","clienteId","responsavelId","prazo","prioridade","ordem","createdAt","updatedAt")
    VALUES (${id}, ${quadroId}, ${colunaId}, ${workspaceId}, ${titulo.trim()}, ${b.descricao || null}, ${clienteId}, ${responsavelId}, ${prazo ? new Date(prazo) : null}, ${prioridade}, ${Number(maxOrdem) + 1}, NOW(), NOW())
  `
  const usuario = session.user.name || session.user.email || 'Usuária'
  await prisma.$executeRaw`
    INSERT INTO "TarefaHistorico" ("id","tarefaId","workspaceId","tipo","descricao","usuarioNome","createdAt")
    VALUES (${novoId()}, ${id}, ${workspaceId}, 'criada', 'Tarefa criada', ${usuario}, NOW())
  `
  return NextResponse.json({ ok: true, id })
}
