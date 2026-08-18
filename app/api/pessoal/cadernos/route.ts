// Cadernos das Notas pessoais. Escopo por userId. GET lista (com contagem de notas), POST cria.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize, gid } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const rows = await prisma.$queryRaw`
    SELECT c."id", c."nome", c."cor", c."icone", c."ordem", c."arquivado",
           (SELECT COUNT(*)::int FROM "PessoalNota" n WHERE n."cadernoId" = c."id" AND n."userId" = ${g.userId} AND NOT n."arquivada") AS "notas"
    FROM "PessoalCaderno" c
    WHERE c."userId" = ${g.userId}
    ORDER BY c."arquivado" ASC, c."ordem" ASC, c."nome" ASC
  `
  return NextResponse.json(serialize(rows))
}

export async function POST(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const b = await req.json().catch(() => ({}))
  const nome = String(b?.nome ?? '').trim()
  if (!nome) return NextResponse.json({ error: 'Informe um nome' }, { status: 400 })
  const id = gid()
  await prisma.$executeRaw`
    INSERT INTO "PessoalCaderno" ("id","userId","nome","cor","icone","ordem","arquivado","createdAt")
    VALUES (${id}, ${g.userId}, ${nome}, ${b?.cor || null}, ${b?.icone || null},
            COALESCE((SELECT MAX("ordem")+1 FROM "PessoalCaderno" WHERE "userId" = ${g.userId}), 0), false, NOW())
  `
  return NextResponse.json({ ok: true, id }, { status: 201 })
}
