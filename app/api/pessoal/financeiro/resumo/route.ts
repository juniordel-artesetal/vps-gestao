// Dashboard de finanças pessoais: KPIs do mês + saldo em contas + pizza por categoria +
// evolução 12 meses + a receber/pagar. Realizado = status PAGO. Escopo por userId.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export async function GET(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const sp = new URL(req.url).searchParams
  const ano = parseInt(sp.get('ano') || String(new Date().getFullYear()))
  const mes = parseInt(sp.get('mes') || String(new Date().getMonth() + 1))
  const u = g.userId

  const [tot] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(CASE WHEN "tipo"='RECEITA' AND "status"='PAGO' THEN "valor" ELSE 0 END),0)::float AS "totalReceita",
           COALESCE(SUM(CASE WHEN "tipo"='DESPESA' AND "status"='PAGO' THEN "valor" ELSE 0 END),0)::float AS "totalDespesa",
           COALESCE(SUM(CASE WHEN "tipo"='RECEITA' AND "status"='PENDENTE' THEN "valor" ELSE 0 END),0)::float AS "aReceber",
           COALESCE(SUM(CASE WHEN "tipo"='DESPESA' AND "status"='PENDENTE' THEN "valor" ELSE 0 END),0)::float AS "aPagar"
    FROM "PessoalLancamento" WHERE "userId"=${u} AND EXTRACT(YEAR FROM "data")=${ano} AND EXTRACT(MONTH FROM "data")=${mes}
  ` as any[]

  // Saldo POR CONTA (saldoInicial + realizado PAGO da conta) + total.
  const saldoPorConta = await prisma.$queryRaw`
    SELECT c."id", c."nome", c."cor",
      (c."saldoInicial"
        + COALESCE(SUM(CASE WHEN l."tipo"='RECEITA' AND l."status"='PAGO' THEN l."valor" ELSE 0 END),0)
        - COALESCE(SUM(CASE WHEN l."tipo"='DESPESA' AND l."status"='PAGO' THEN l."valor" ELSE 0 END),0)
        - COALESCE(SUM(CASE WHEN l."tipo"='RESERVA' AND l."status"='PAGO' THEN l."valor" ELSE 0 END),0)
        + COALESCE(SUM(CASE WHEN l."tipo"='RESGATE' AND l."status"='PAGO' THEN l."valor" ELSE 0 END),0))::float AS saldo
    FROM "PessoalConta" c LEFT JOIN "PessoalLancamento" l ON l."contaId"=c."id" AND l."userId"=c."userId"
    WHERE c."userId"=${u} AND c."ativo"=true
    GROUP BY c."id", c."nome", c."cor", c."saldoInicial" ORDER BY c."nome"
  ` as any[]
  const saldo = [{ saldoTotal: saldoPorConta.reduce((s: number, c: any) => s + Number(c.saldo), 0) }]

  const catReceita = await prisma.$queryRaw`
    SELECT COALESCE(c."nome",'Sem categoria') AS nome, COALESCE(c."cor",'#16a34a') AS cor, COALESCE(c."icone",'💰') AS icone,
           COALESCE(SUM(l."valor"),0)::float AS total
    FROM "PessoalLancamento" l LEFT JOIN "PessoalCategoria" c ON c."id"=l."categoriaId"
    WHERE l."userId"=${u} AND l."tipo"='RECEITA' AND l."status"='PAGO'
      AND EXTRACT(YEAR FROM l."data")=${ano} AND EXTRACT(MONTH FROM l."data")=${mes}
    GROUP BY c."nome",c."cor",c."icone" ORDER BY total DESC
  `
  const catDespesa = await prisma.$queryRaw`
    SELECT COALESCE(c."nome",'Sem categoria') AS nome, COALESCE(c."cor",'#dc2626') AS cor, COALESCE(c."icone",'💸') AS icone,
           COALESCE(SUM(l."valor"),0)::float AS total
    FROM "PessoalLancamento" l LEFT JOIN "PessoalCategoria" c ON c."id"=l."categoriaId"
    WHERE l."userId"=${u} AND l."tipo"='DESPESA' AND l."status"='PAGO'
      AND EXTRACT(YEAR FROM l."data")=${ano} AND EXTRACT(MONTH FROM l."data")=${mes}
    GROUP BY c."nome",c."cor",c."icone" ORDER BY total DESC
  `

  const chartRaw = await prisma.$queryRaw`
    SELECT EXTRACT(YEAR FROM "data")::int AS ano, EXTRACT(MONTH FROM "data")::int AS mes,
           COALESCE(SUM(CASE WHEN "tipo"='RECEITA' THEN "valor" ELSE 0 END),0)::float AS receita,
           COALESCE(SUM(CASE WHEN "tipo"='DESPESA' THEN "valor" ELSE 0 END),0)::float AS despesa
    FROM "PessoalLancamento" WHERE "userId"=${u} AND "status"='PAGO' AND "data" >= (CURRENT_DATE - INTERVAL '11 months')::date
    GROUP BY ano,mes ORDER BY ano,mes
  ` as any[]

  const [{ ultimos }] = await prisma.$queryRaw`
    SELECT COALESCE(json_agg(x ORDER BY x."data" DESC),'[]') AS ultimos FROM (
      SELECT l."id", l."tipo", l."descricao", l."valor"::float AS valor, l."data", l."status",
             c."nome" AS "categoriaNome", c."icone" AS "categoriaIcone"
      FROM "PessoalLancamento" l LEFT JOIN "PessoalCategoria" c ON c."id"=l."categoriaId"
      WHERE l."userId"=${u} ORDER BY l."data" DESC, l."createdAt" DESC LIMIT 8
    ) x
  ` as any[]

  const r = tot || {}
  return NextResponse.json(serialize({
    ano, mes,
    totalReceita: r.totalReceita || 0, totalDespesa: r.totalDespesa || 0,
    resultado: (r.totalReceita || 0) - (r.totalDespesa || 0),
    aReceber: r.aReceber || 0, aPagar: r.aPagar || 0,
    saldoTotal: saldo[0]?.saldoTotal || 0,
    saldoPorConta,
    catReceita, catDespesa,
    chart: chartRaw.map(c => ({ label: MESES[Number(c.mes) - 1], receita: Number(c.receita), despesa: Number(c.despesa), resultado: Number(c.receita) - Number(c.despesa) })),
    ultimos: ultimos || [],
  }))
}
