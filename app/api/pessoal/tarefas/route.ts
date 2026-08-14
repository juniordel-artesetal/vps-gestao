// Tarefas pessoais. Escopo por userId. status: PENDENTE | EM_ANDAMENTO | CONCLUIDA.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize, gid, parseData } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'
const STATUS = ['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA']
const PRIOS = ['BAIXA', 'MEDIA', 'ALTA']

export async function GET() {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const rows = await prisma.$queryRaw`
    SELECT "id","titulo","descricao","prazo","prioridade","status",
           TO_CHAR("concluidaEm",'YYYY-MM-DD"T"HH24:MI:SSOF') AS "concluidaEm", "createdAt"
    FROM "PessoalTarefa" WHERE "userId" = ${g.userId}
    ORDER BY (CASE WHEN "status"='CONCLUIDA' THEN 1 ELSE 0 END), "prazo" ASC NULLS LAST, "createdAt" DESC
  `
  return NextResponse.json(serialize(rows))
}

export async function POST(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const b = await req.json().catch(() => ({}))
  const titulo = String(b?.titulo ?? '').trim()
  if (!titulo) return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 })
  const prioridade = PRIOS.includes(b?.prioridade) ? b.prioridade : 'MEDIA'
  const status = STATUS.includes(b?.status) ? b.status : 'PENDENTE'
  const id = gid()
  await prisma.$executeRaw`
    INSERT INTO "PessoalTarefa" ("id","userId","titulo","descricao","prazo","prioridade","status","createdAt")
    VALUES (${id}, ${g.userId}, ${titulo}, ${b?.descricao || null}, ${parseData(b?.prazo)}::date, ${prioridade}, ${status}, NOW())
  `
  return NextResponse.json({ ok: true, id }, { status: 201 })
}
