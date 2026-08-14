// Contas pessoais (Nubank, carteira, poupança…) com saldo calculado. Escopo por userId.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize, gid, parseNum } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const contas = await prisma.$queryRaw`
    SELECT c."id", c."nome", c."tipo", c."instituicao", c."saldoInicial"::float AS "saldoInicial",
           c."cor", c."ativo",
           c."saldoInicial"::float
             + COALESCE(SUM(CASE WHEN l."tipo"='RECEITA' AND l."status"='PAGO' THEN l."valor" ELSE 0 END),0)::float
             - COALESCE(SUM(CASE WHEN l."tipo"='DESPESA' AND l."status"='PAGO' THEN l."valor" ELSE 0 END),0)::float
             AS "saldo"
    FROM "PessoalConta" c
    LEFT JOIN "PessoalLancamento" l ON l."contaId" = c."id" AND l."userId" = c."userId"
    WHERE c."userId" = ${g.userId}
    GROUP BY c."id", c."nome", c."tipo", c."instituicao", c."saldoInicial", c."cor", c."ativo"
    ORDER BY c."ativo" DESC, c."nome" ASC
  `
  return NextResponse.json(serialize(contas))
}

export async function POST(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const b = await req.json().catch(() => ({}))
  const nome = String(b?.nome ?? '').trim()
  if (!nome) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  const id = gid()
  await prisma.$executeRaw`
    INSERT INTO "PessoalConta" ("id","userId","nome","tipo","instituicao","saldoInicial","cor","ativo","createdAt")
    VALUES (${id}, ${g.userId}, ${nome}, ${b?.tipo || null}, ${b?.instituicao || null},
            ${parseNum(b?.saldoInicial)}, ${b?.cor || null}, ${b?.ativo === false ? false : true}, NOW())
  `
  return NextResponse.json({ ok: true, id }, { status: 201 })
}
