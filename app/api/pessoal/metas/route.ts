// Metas mensais pessoais (receita/despesa/economia) + realizado do mês pra progresso. Escopo por userId.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize, gid, parseNum } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const sp = new URL(req.url).searchParams
  const ano = parseInt(sp.get('ano') || String(new Date().getFullYear()))
  const mes = parseInt(sp.get('mes') || String(new Date().getMonth() + 1))
  const u = g.userId

  const [meta] = await prisma.$queryRaw`
    SELECT "metaReceita"::float AS "metaReceita", "metaDespesa"::float AS "metaDespesa", "metaEconomia"::float AS "metaEconomia"
    FROM "PessoalMeta" WHERE "userId"=${u} AND "ano"=${ano} AND "mes"=${mes} LIMIT 1
  ` as any[]
  const [real] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(CASE WHEN "tipo"='RECEITA' AND "status"='PAGO' THEN "valor" ELSE 0 END),0)::float AS receita,
           COALESCE(SUM(CASE WHEN "tipo"='DESPESA' AND "status"='PAGO' THEN "valor" ELSE 0 END),0)::float AS despesa
    FROM "PessoalLancamento" WHERE "userId"=${u} AND EXTRACT(YEAR FROM "data")=${ano} AND EXTRACT(MONTH FROM "data")=${mes}
  ` as any[]
  const economia = Number(real?.receita || 0) - Number(real?.despesa || 0)
  return NextResponse.json(serialize({ ano, mes, meta: meta || null, realizado: { receita: real?.receita || 0, despesa: real?.despesa || 0, economia } }))
}

export async function POST(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const b = await req.json().catch(() => ({}))
  const ano = Number(b?.ano), mes = Number(b?.mes)
  if (!ano || !mes) return NextResponse.json({ error: 'Informe ano e mês.' }, { status: 400 })
  const mr = b?.metaReceita != null ? parseNum(b.metaReceita) : null
  const md = b?.metaDespesa != null ? parseNum(b.metaDespesa) : null
  const me = b?.metaEconomia != null ? parseNum(b.metaEconomia) : null
  await prisma.$executeRaw`
    INSERT INTO "PessoalMeta" ("id","userId","ano","mes","metaReceita","metaDespesa","metaEconomia","createdAt")
    VALUES (${gid()}, ${g.userId}, ${ano}, ${mes}, ${mr}, ${md}, ${me}, NOW())
    ON CONFLICT ("userId","ano","mes") DO UPDATE SET
      "metaReceita" = EXCLUDED."metaReceita", "metaDespesa" = EXCLUDED."metaDespesa", "metaEconomia" = EXCLUDED."metaEconomia"
  `
  return NextResponse.json({ ok: true })
}
