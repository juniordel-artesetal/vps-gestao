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
  const semPrazo = sp.get('semPrazo') === '1'
  const de = (sp.get('de') || '').match(/^\d{4}-\d{2}-\d{2}$/) ? sp.get('de')! : ''
  const ate = (sp.get('ate') || '').match(/^\d{4}-\d{2}-\d{2}$/) ? sp.get('ate')! : ''
  const where: string[] = [`t."userId" = $1`]
  const vals: any[] = [g.userId]
  if (STATUS.includes(status)) { vals.push(status); where.push(`t."status" = $${vals.length}`) }
  if (hoje) where.push(`t."prazo" = CURRENT_DATE`)
  if (atrasadas) where.push(`t."prazo" < CURRENT_DATE AND t."status" <> 'CONCLUIDA'`)
  if (semPrazo) where.push(`t."prazo" IS NULL`)
  if (de) { vals.push(de); where.push(`t."prazo" >= $${vals.length}::date`) }
  if (ate) { vals.push(ate); where.push(`t."prazo" <= $${vals.length}::date`) }
  const rows = await prisma.$queryRawUnsafe(`
    SELECT t."id", t."titulo", t."descricao", t."prazo", t."prioridade", t."status", (t."imagem" IS NOT NULL) AS "temImagem",
           t."notaId", t."ordem", TO_CHAR(t."lembrete",'YYYY-MM-DD"T"HH24:MI') AS "lembrete",
           TO_CHAR(t."concluidaEm",'YYYY-MM-DD"T"HH24:MI:SSOF') AS "concluidaEm", t."createdAt",
           (SELECT COUNT(*)::int FROM "PessoalSubtarefa" s WHERE s."tarefaId" = t."id") AS "subTotal",
           (SELECT COUNT(*)::int FROM "PessoalSubtarefa" s WHERE s."tarefaId" = t."id" AND s."concluida") AS "subFeitas"
    FROM "PessoalTarefa" t WHERE ${where.join(' AND ')}
    ORDER BY (CASE WHEN t."status"='CONCLUIDA' THEN 1 ELSE 0 END), t."prazo" ASC NULLS LAST, t."ordem" ASC, t."createdAt" DESC
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
