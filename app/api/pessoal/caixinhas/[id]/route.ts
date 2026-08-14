// Uma caixinha: GET (detalhe + movimentos) / PUT (editar nome/cor/meta) / DELETE. Escopo por userId.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize, parseNum } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const [cx] = await prisma.$queryRaw`
    SELECT c."id", c."nome", c."cor", c."meta"::float AS meta,
           COALESCE(SUM(CASE WHEN m."tipo"='DEPOSITO' THEN m."valor" WHEN m."tipo"='RETIRADA' THEN -m."valor" ELSE 0 END),0)::float AS saldo
    FROM "PessoalCaixinha" c
    LEFT JOIN "PessoalCaixinhaMov" m ON m."caixinhaId" = c."id" AND m."userId" = c."userId"
    WHERE c."id" = ${id} AND c."userId" = ${g.userId}
    GROUP BY c."id", c."nome", c."cor", c."meta" LIMIT 1
  ` as any[]
  if (!cx) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  const movs = await prisma.$queryRaw`
    SELECT m."id", m."tipo", m."valor"::float AS valor, m."data", m."contaId", m."obs", ct."nome" AS "contaNome"
    FROM "PessoalCaixinhaMov" m LEFT JOIN "PessoalConta" ct ON ct."id" = m."contaId"
    WHERE m."caixinhaId" = ${id} AND m."userId" = ${g.userId}
    ORDER BY m."data" DESC, m."createdAt" DESC LIMIT 100
  `
  return NextResponse.json(serialize({ ...cx, movimentos: movs }))
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const b = await req.json().catch(() => ({}))
  const meta = b?.meta === undefined ? null : (String(b.meta) === '' ? null : parseNum(b.meta))
  await prisma.$executeRaw`
    UPDATE "PessoalCaixinha" SET
      "nome" = COALESCE(${b?.nome ? String(b.nome).trim().slice(0, 60) : null}, "nome"),
      "cor" = ${b?.cor ?? null},
      "meta" = ${meta}
    WHERE "id" = ${id} AND "userId" = ${g.userId}
  `
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  // Movimentos caem por ON DELETE CASCADE. Não cria/remove lançamentos.
  await prisma.$executeRaw`DELETE FROM "PessoalCaixinha" WHERE "id" = ${id} AND "userId" = ${g.userId}`
  return NextResponse.json({ ok: true })
}
