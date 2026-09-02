// Fluxo de caixa pessoal: por dia do mês (entradas/saídas realizadas + a receber/pagar)
// com saldo acumulado a partir do saldo anterior. Escopo por userId.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const sp = new URL(req.url).searchParams
  const ano = parseInt(sp.get('ano') || String(new Date().getFullYear()))
  const mes = parseInt(sp.get('mes') || String(new Date().getMonth() + 1))
  const u = g.userId
  const corte = new Date(Date.UTC(ano, mes - 1, 1))

  const [ant] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(c."saldoInicial"),0)::float
      + COALESCE(SUM(CASE WHEN l."tipo"='RECEITA' AND l."status"='PAGO' AND l."data" < ${corte} THEN l."valor" ELSE 0 END),0)::float
      - COALESCE(SUM(CASE WHEN l."tipo"='DESPESA' AND l."status"='PAGO' AND l."data" < ${corte} THEN l."valor" ELSE 0 END),0)::float
      - COALESCE(SUM(CASE WHEN l."tipo"='RESERVA' AND l."status"='PAGO' AND l."data" < ${corte} THEN l."valor" ELSE 0 END),0)::float
      + COALESCE(SUM(CASE WHEN l."tipo"='RESGATE' AND l."status"='PAGO' AND l."data" < ${corte} THEN l."valor" ELSE 0 END),0)::float AS saldo
    FROM "PessoalConta" c LEFT JOIN "PessoalLancamento" l ON l."contaId"=c."id" AND l."userId"=c."userId"
    WHERE c."userId"=${u}
  ` as any[]
  const saldoAnterior = Number(ant?.saldo || 0)

  const dias = await prisma.$queryRaw`
    SELECT EXTRACT(DAY FROM "data")::int AS dia,
      COALESCE(SUM(CASE WHEN "tipo"='RECEITA' AND "status"='PAGO' THEN "valor" ELSE 0 END),0)::float AS receita,
      COALESCE(SUM(CASE WHEN "tipo"='DESPESA' AND "status"='PAGO' THEN "valor" ELSE 0 END),0)::float AS despesa,
      COALESCE(SUM(CASE WHEN "tipo"='RECEITA' AND "status"='PENDENTE' THEN "valor" ELSE 0 END),0)::float AS "aReceber",
      COALESCE(SUM(CASE WHEN "tipo"='DESPESA' AND "status"='PENDENTE' THEN "valor" ELSE 0 END),0)::float AS "aPagar"
    FROM "PessoalLancamento" WHERE "userId"=${u} AND EXTRACT(YEAR FROM "data")=${ano} AND EXTRACT(MONTH FROM "data")=${mes}
    GROUP BY dia ORDER BY dia
  ` as any[]

  // Lançamentos do mês (RECEITA/DESPESA) p/ o drill-down do dia — RESERVA/RESGATE ficam de fora (= as 4 colunas).
  const lancs = await prisma.$queryRaw`
    SELECT EXTRACT(DAY FROM l."data")::int AS dia,
           l."id", l."tipo", l."descricao", l."valor"::float AS valor, l."status",
           l."parcela", l."totalParcelas",
           c."icone" AS "categoriaIcone", c."nome" AS "categoriaNome", ct."nome" AS "contaNome"
    FROM "PessoalLancamento" l
    LEFT JOIN "PessoalCategoria" c ON c."id"=l."categoriaId"
    LEFT JOIN "PessoalConta" ct ON ct."id"=l."contaId"
    WHERE l."userId"=${u} AND l."tipo" IN ('RECEITA','DESPESA')
      AND EXTRACT(YEAR FROM l."data")=${ano} AND EXTRACT(MONTH FROM l."data")=${mes}
    ORDER BY l."data", l."createdAt"
  ` as any[]
  const lancMap = new Map<number, any[]>()
  for (const l of lancs) { const dia = Number(l.dia); if (!lancMap.has(dia)) lancMap.set(dia, []); lancMap.get(dia)!.push(l) }

  const diasNoMes = new Date(ano, mes, 0).getDate()
  const map = new Map(dias.map(d => [Number(d.dia), d]))
  let acc = saldoAnterior
  const linhas = Array.from({ length: diasNoMes }, (_, i) => {
    const d = map.get(i + 1)
    const receita = Number(d?.receita || 0), despesa = Number(d?.despesa || 0)
    acc += receita - despesa
    return { dia: i + 1, receita, despesa, aReceber: Number(d?.aReceber || 0), aPagar: Number(d?.aPagar || 0), saldoDia: receita - despesa, saldoAcumulado: acc, lancamentos: lancMap.get(i + 1) || [] }
  })

  return NextResponse.json(serialize({
    ano, mes, diasNoMes, saldoAnterior,
    totalReceita: linhas.reduce((s, d) => s + d.receita, 0),
    totalDespesa: linhas.reduce((s, d) => s + d.despesa, 0),
    totalAReceber: linhas.reduce((s, d) => s + d.aReceber, 0),
    totalAPagar: linhas.reduce((s, d) => s + d.aPagar, 0),
    saldoFinal: acc, dias: linhas,
  }))
}
