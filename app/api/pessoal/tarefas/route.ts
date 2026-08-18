// Tarefas pessoais. Escopo por userId. status: PENDENTE | EM_ANDAMENTO | CONCLUIDA.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize, gid, parseData, parseLembrete } from '@/lib/pessoal/api'
import { normalizarImagemEntrada } from '@/lib/pessoal/imagem'

export const dynamic = 'force-dynamic'
const STATUS = ['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA']
const PRIOS = ['BAIXA', 'MEDIA', 'ALTA']

export async function GET(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const sp = new URL(req.url).searchParams
  const status = sp.get('status') || ''
  const hoje = sp.get('hoje') === '1'
  const atrasadas = sp.get('atrasadas') === '1'
  const where: string[] = [`"userId" = $1`]
  const vals: any[] = [g.userId]
  if (STATUS.includes(status)) { vals.push(status); where.push(`"status" = $${vals.length}`) }
  if (hoje) where.push(`"prazo" = CURRENT_DATE`)
  if (atrasadas) where.push(`"prazo" < CURRENT_DATE AND "status" <> 'CONCLUIDA'`)
  const rows = await prisma.$queryRawUnsafe(`
    SELECT "id","titulo","descricao","prazo","prioridade","status", ("imagem" IS NOT NULL) AS "temImagem",
           "notaId", TO_CHAR("lembrete",'YYYY-MM-DD"T"HH24:MI') AS "lembrete",
           TO_CHAR("concluidaEm",'YYYY-MM-DD"T"HH24:MI:SSOF') AS "concluidaEm", "createdAt"
    FROM "PessoalTarefa" WHERE ${where.join(' AND ')}
    ORDER BY (CASE WHEN "status"='CONCLUIDA' THEN 1 ELSE 0 END), "prazo" ASC NULLS LAST, "ordem" ASC, "createdAt" DESC
  `, ...vals)
  return NextResponse.json(serialize(rows))
}

export async function POST(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const b = await req.json().catch(() => ({}))
  const titulo = String(b?.titulo ?? '').trim()
  if (!titulo) return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 })
  const prioridade = PRIOS.includes(b?.prioridade) ? b.prioridade : 'MEDIA'
  const status = STATUS.includes(b?.status) ? b.status : 'PENDENTE'
  let imagem: string | null
  try { imagem = (normalizarImagemEntrada(b?.imagem) ?? null) as string | null }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
  const lembrete = parseLembrete(b?.lembrete)
  const notaId = b?.notaId ? String(b.notaId) : null
  const id = gid()
  await prisma.$executeRaw`
    INSERT INTO "PessoalTarefa" ("id","userId","titulo","descricao","prazo","prioridade","status","lembrete","lembreteEnviado","notaId","imagem","createdAt")
    VALUES (${id}, ${g.userId}, ${titulo}, ${b?.descricao || null}, ${parseData(b?.prazo)}::date, ${prioridade}, ${status},
            ${lembrete}::timestamptz, false, ${notaId}, ${imagem}, NOW())
  `
  return NextResponse.json({ ok: true, id }, { status: 201 })
}
