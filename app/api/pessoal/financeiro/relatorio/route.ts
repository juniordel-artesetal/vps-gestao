// Relatório financeiro pessoal por período (para o print-view/PDF client-side).
// Agrega: resumo, por categoria, por conta, fluxo diário, caixinhas e lista de lançamentos.
// Escopo por userId. Aceita ano/mes (default mês atual) OU de/ate.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize, parseData } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const u = g.userId
  const sp = new URL(req.url).searchParams
  const de = parseData(sp.get('de')), ate = parseData(sp.get('ate'))
  const usaPeriodo = !!(de || ate)
  const ano = parseInt(sp.get('ano') || String(new Date().getFullYear()))
  const mes = parseInt(sp.get('mes') || String(new Date().getMonth() + 1))

  // Janela de datas (usada nas queries por período).
  const ini = usaPeriodo ? (de || '1900-01-01') : `${ano}-${String(mes).padStart(2, '0')}-01`
  const fimMes = usaPeriodo ? (ate || '2999-12-31') : new Date(ano, mes, 0).toISOString().slice(0, 10)

  const [tot] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(CASE WHEN "tipo"='RECEITA' AND "status"='PAGO' THEN "valor" ELSE 0 END),0)::float AS "totalReceita",
           COALESCE(SUM(CASE WHEN "tipo"='DESPESA' AND "status"='PAGO' THEN "valor" ELSE 0 END),0)::float AS "totalDespesa",
           COALESCE(SUM(CASE WHEN "tipo"='RECEITA' AND "status"='PENDENTE' THEN "valor" ELSE 0 END),0)::float AS "aReceber",
           COALESCE(SUM(CASE WHEN "tipo"='DESPESA' AND "status"='PENDENTE' THEN "valor" ELSE 0 END),0)::float AS "aPagar"
    FROM "PessoalLancamento" WHERE "userId"=${u} AND "data" >= ${ini}::date AND "data" <= ${fimMes}::date
  ` as any[]

  const porCategoria = await prisma.$queryRaw`
    SELECT COALESCE(c."nome",'Sem categoria') AS nome, l."tipo",
           COALESCE(c."icone",'') AS icone, COALESCE(SUM(l."valor"),0)::float AS total
    FROM "PessoalLancamento" l LEFT JOIN "PessoalCategoria" c ON c."id"=l."categoriaId"
    WHERE l."userId"=${u} AND l."status"='PAGO' AND l."tipo" IN ('RECEITA','DESPESA')
      AND l."data" >= ${ini}::date AND l."data" <= ${fimMes}::date
    GROUP BY c."nome", l."tipo", c."icone" ORDER BY l."tipo", total DESC
  `

  const porConta = await prisma.$queryRaw`
    SELECT ct."nome",
      COALESCE(SUM(CASE WHEN l."tipo"='RECEITA' AND l."status"='PAGO' THEN l."valor" ELSE 0 END),0)::float AS receita,
      COALESCE(SUM(CASE WHEN l."tipo"='DESPESA' AND l."status"='PAGO' THEN l."valor" ELSE 0 END),0)::float AS despesa,
      ct."saldoInicial"::float
        + COALESCE(SUM(CASE WHEN l."tipo"='RECEITA' AND l."status"='PAGO' THEN l."valor" ELSE 0 END),0)::float
        - COALESCE(SUM(CASE WHEN l."tipo"='DESPESA' AND l."status"='PAGO' THEN l."valor" ELSE 0 END),0)::float
        - COALESCE(SUM(CASE WHEN l."tipo"='RESERVA' AND l."status"='PAGO' THEN l."valor" ELSE 0 END),0)::float
        + COALESCE(SUM(CASE WHEN l."tipo"='RESGATE' AND l."status"='PAGO' THEN l."valor" ELSE 0 END),0)::float AS saldo
    FROM "PessoalConta" ct
    LEFT JOIN "PessoalLancamento" l ON l."contaId"=ct."id" AND l."userId"=ct."userId" AND l."data" >= ${ini}::date AND l."data" <= ${fimMes}::date
    WHERE ct."userId"=${u} AND ct."ativo"=true
    GROUP BY ct."id", ct."nome", ct."saldoInicial" ORDER BY ct."nome"
  `

  const caixinhas = await prisma.$queryRaw`
    SELECT c."nome", c."meta"::float AS meta,
           COALESCE(SUM(CASE WHEN m."tipo"='DEPOSITO' THEN m."valor" WHEN m."tipo"='RETIRADA' THEN -m."valor" ELSE 0 END),0)::float AS saldo
    FROM "PessoalCaixinha" c LEFT JOIN "PessoalCaixinhaMov" m ON m."caixinhaId"=c."id" AND m."userId"=c."userId"
    WHERE c."userId"=${u} GROUP BY c."id", c."nome", c."meta", c."createdAt" ORDER BY c."createdAt"
  `

  const fluxo = await prisma.$queryRaw`
    SELECT "data",
      COALESCE(SUM(CASE WHEN "tipo"='RECEITA' AND "status"='PAGO' THEN "valor" ELSE 0 END),0)::float AS receita,
      COALESCE(SUM(CASE WHEN "tipo"='DESPESA' AND "status"='PAGO' THEN "valor" ELSE 0 END),0)::float AS despesa
    FROM "PessoalLancamento" WHERE "userId"=${u} AND "status"='PAGO' AND "data" >= ${ini}::date AND "data" <= ${fimMes}::date
    GROUP BY "data" ORDER BY "data"
  `

  const lancamentos = await prisma.$queryRaw`
    SELECT l."tipo", l."descricao", l."valor"::float AS valor, l."data", l."status", l."metodo",
           c."nome" AS "categoriaNome", ct."nome" AS "contaNome"
    FROM "PessoalLancamento" l
    LEFT JOIN "PessoalCategoria" c ON c."id"=l."categoriaId"
    LEFT JOIN "PessoalConta" ct ON ct."id"=l."contaId"
    WHERE l."userId"=${u} AND l."data" >= ${ini}::date AND l."data" <= ${fimMes}::date
    ORDER BY l."data" ASC, l."createdAt" ASC
  `

  const r = tot || {}
  return NextResponse.json(serialize({
    periodo: { de: ini, ate: fimMes, ano, mes, usaPeriodo },
    resumo: {
      totalReceita: r.totalReceita || 0, totalDespesa: r.totalDespesa || 0,
      resultado: (r.totalReceita || 0) - (r.totalDespesa || 0),
      aReceber: r.aReceber || 0, aPagar: r.aPagar || 0,
    },
    porCategoria, porConta, caixinhas, fluxo, lancamentos,
  }))
}
