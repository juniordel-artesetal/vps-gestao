// Caixinhas pessoais (reservas estilo Nubank): lista com saldo calculado + criar. Escopo por userId.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize, gid, parseNum } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const rows = await prisma.$queryRaw`
    SELECT c."id", c."nome", c."cor", c."meta"::float AS meta,
           COALESCE(SUM(CASE WHEN m."tipo"='DEPOSITO' THEN m."valor" WHEN m."tipo"='RETIRADA' THEN -m."valor" ELSE 0 END),0)::float AS saldo,
           COUNT(m."id")::int AS movimentos
    FROM "PessoalCaixinha" c
    LEFT JOIN "PessoalCaixinhaMov" m ON m."caixinhaId" = c."id" AND m."userId" = c."userId"
    WHERE c."userId" = ${g.userId}
    GROUP BY c."id", c."nome", c."cor", c."meta", c."createdAt"
    ORDER BY c."createdAt" ASC
  `
  return NextResponse.json(serialize(rows))
}

export async function POST(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const b = await req.json().catch(() => ({}))
  const nome = String(b?.nome ?? '').trim()
  if (!nome) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  const meta = b?.meta !== undefined && b?.meta !== null && String(b.meta) !== '' ? parseNum(b.meta) : null
  const id = gid()
  await prisma.$executeRaw`
    INSERT INTO "PessoalCaixinha" ("id","userId","nome","cor","meta","saldo","createdAt")
    VALUES (${id}, ${g.userId}, ${nome.slice(0, 60)}, ${b?.cor || null}, ${meta}, 0, NOW())
  `
  return NextResponse.json({ ok: true, id }, { status: 201 })
}
