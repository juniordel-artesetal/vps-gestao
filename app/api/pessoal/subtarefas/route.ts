// Subtarefas (checklist) de uma tarefa pessoal. Escopo por userId; a tarefa tem que ser do usuário.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize, gid } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const tarefaId = new URL(req.url).searchParams.get('tarefa') || ''
  if (!tarefaId) return NextResponse.json({ error: 'Informe a tarefa' }, { status: 400 })
  const rows = await prisma.$queryRaw`
    SELECT "id","tarefaId","titulo","concluida","ordem","createdAt"
    FROM "PessoalSubtarefa" WHERE "userId" = ${g.userId} AND "tarefaId" = ${tarefaId}
    ORDER BY "ordem" ASC, "createdAt" ASC
  `
  return NextResponse.json(serialize(rows))
}

export async function POST(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const b = await req.json().catch(() => ({}))
  const tarefaId = String(b?.tarefaId || '')
  const titulo = String(b?.titulo ?? '').trim()
  if (!tarefaId || !titulo) return NextResponse.json({ error: 'Informe tarefa e título' }, { status: 400 })
  // A tarefa é do usuário?
  const [dono] = await prisma.$queryRaw`SELECT 1 AS ok FROM "PessoalTarefa" WHERE "id" = ${tarefaId} AND "userId" = ${g.userId} LIMIT 1` as any[]
  if (!dono) return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
  const id = gid()
  await prisma.$executeRaw`
    INSERT INTO "PessoalSubtarefa" ("id","userId","tarefaId","titulo","concluida","ordem","createdAt")
    VALUES (${id}, ${g.userId}, ${tarefaId}, ${titulo}, false,
            COALESCE((SELECT MAX("ordem")+1 FROM "PessoalSubtarefa" WHERE "tarefaId" = ${tarefaId}), 0), NOW())
  `
  return NextResponse.json({ ok: true, id }, { status: 201 })
}
