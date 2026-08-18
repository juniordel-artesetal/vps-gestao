// Tags das Notas pessoais. Escopo por userId. GET lista (com contagem), POST cria (dedup por nome).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize, gid } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const rows = await prisma.$queryRaw`
    SELECT t."id", t."nome", t."cor",
           (SELECT COUNT(*)::int FROM "PessoalNotaTag" nt
              JOIN "PessoalNota" n ON n."id" = nt."notaId"
             WHERE nt."tagId" = t."id" AND n."userId" = ${g.userId} AND NOT n."arquivada") AS "notas"
    FROM "PessoalTag" t
    WHERE t."userId" = ${g.userId}
    ORDER BY t."nome" ASC
  `
  return NextResponse.json(serialize(rows))
}

export async function POST(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const b = await req.json().catch(() => ({}))
  const nome = String(b?.nome ?? '').trim()
  if (!nome) return NextResponse.json({ error: 'Informe um nome' }, { status: 400 })
  // Dedup por (userId, lower(nome)): reusa a existente em vez de duplicar.
  const [ex] = await prisma.$queryRaw`
    SELECT "id" FROM "PessoalTag" WHERE "userId" = ${g.userId} AND lower("nome") = ${nome.toLowerCase()} LIMIT 1
  ` as { id: string }[]
  if (ex) return NextResponse.json({ ok: true, id: ex.id, existente: true })
  const id = gid()
  await prisma.$executeRaw`
    INSERT INTO "PessoalTag" ("id","userId","nome","cor","createdAt")
    VALUES (${id}, ${g.userId}, ${nome}, ${b?.cor || null}, NOW())
  `
  return NextResponse.json({ ok: true, id }, { status: 201 })
}
