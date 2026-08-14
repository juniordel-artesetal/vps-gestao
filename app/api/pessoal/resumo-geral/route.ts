// Resumo-geral do módulo Pessoal (home /pessoal): KPIs + Finanças + Tarefas + Notas numa chamada.
// Escopo por userId (guardPessoal). Mesmas regras dos módulos (realizado = PAGO). serialize inline.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const u = g.userId

  // ── FINANÇAS ────────────────────────────────────────────────────────────
  const saldoPorConta = await prisma.$queryRaw`
    SELECT c."id", c."nome", c."cor",
      (c."saldoInicial"
        + COALESCE(SUM(CASE WHEN l."tipo"='RECEITA' AND l."status"='PAGO' THEN l."valor" ELSE 0 END),0)
        - COALESCE(SUM(CASE WHEN l."tipo"='DESPESA' AND l."status"='PAGO' THEN l."valor" ELSE 0 END),0))::float AS saldo
    FROM "PessoalConta" c LEFT JOIN "PessoalLancamento" l ON l."contaId"=c."id" AND l."userId"=c."userId"
    WHERE c."userId"=${u} AND c."ativo"=true
    GROUP BY c."id", c."nome", c."cor", c."saldoInicial" ORDER BY c."nome"
  ` as any[]
  const saldoTotal = saldoPorConta.reduce((s, c) => s + Number(c.saldo), 0)

  const [mesFin] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(CASE WHEN "tipo"='RECEITA' AND "status"='PAGO' THEN "valor" ELSE 0 END),0)::float AS receitas,
           COALESCE(SUM(CASE WHEN "tipo"='DESPESA' AND "status"='PAGO' THEN "valor" ELSE 0 END),0)::float AS despesas
    FROM "PessoalLancamento" WHERE "userId"=${u}
      AND EXTRACT(YEAR FROM "data")=EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM "data")=EXTRACT(MONTH FROM CURRENT_DATE)
  ` as any[]

  const catDespesa = await prisma.$queryRaw`
    SELECT COALESCE(c."nome",'Sem categoria') AS nome, COALESCE(c."cor",'#dc2626') AS cor, COALESCE(c."icone",'💸') AS icone,
           COALESCE(SUM(l."valor"),0)::float AS total
    FROM "PessoalLancamento" l LEFT JOIN "PessoalCategoria" c ON c."id"=l."categoriaId"
    WHERE l."userId"=${u} AND l."tipo"='DESPESA' AND l."status"='PAGO'
      AND EXTRACT(YEAR FROM l."data")=EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM l."data")=EXTRACT(MONTH FROM CURRENT_DATE)
    GROUP BY c."nome", c."cor", c."icone" ORDER BY total DESC LIMIT 6
  ` as any[]

  const caixinhas = await prisma.$queryRaw`
    SELECT c."id", c."nome", c."cor", c."meta"::float AS meta,
      COALESCE(SUM(CASE WHEN m."tipo"='DEPOSITO' THEN m."valor" WHEN m."tipo"='RETIRADA' THEN -m."valor" ELSE 0 END),0)::float AS saldo
    FROM "PessoalCaixinha" c LEFT JOIN "PessoalCaixinhaMov" m ON m."caixinhaId"=c."id" AND m."userId"=c."userId"
    WHERE c."userId"=${u} GROUP BY c."id", c."nome", c."cor", c."meta", c."createdAt" ORDER BY c."createdAt" LIMIT 6
  ` as any[]
  const guardadoCaixinhas = caixinhas.reduce((s, c) => s + Number(c.saldo), 0)

  const [{ ultimos }] = await prisma.$queryRaw`
    SELECT COALESCE(json_agg(x ORDER BY x."data" DESC, x."createdAt" DESC),'[]') AS ultimos FROM (
      SELECT l."id", l."tipo", l."descricao", l."valor"::float AS valor, l."data", l."status", l."createdAt",
             (l."comprovante" IS NOT NULL) AS "temComprovante",
             c."nome" AS "categoriaNome", c."icone" AS "categoriaIcone"
      FROM "PessoalLancamento" l LEFT JOIN "PessoalCategoria" c ON c."id"=l."categoriaId"
      WHERE l."userId"=${u} ORDER BY l."data" DESC, l."createdAt" DESC LIMIT 5
    ) x
  ` as any[]

  // ── TAREFAS ─────────────────────────────────────────────────────────────
  const [tarefasCont] = await prisma.$queryRaw`
    SELECT
      COALESCE(SUM(CASE WHEN "prazo"=CURRENT_DATE AND "status"<>'CONCLUIDA' THEN 1 ELSE 0 END),0)::int AS hoje,
      COALESCE(SUM(CASE WHEN "status"<>'CONCLUIDA' THEN 1 ELSE 0 END),0)::int AS pendentes,
      COALESCE(SUM(CASE WHEN "prazo"<CURRENT_DATE AND "status"<>'CONCLUIDA' THEN 1 ELSE 0 END),0)::int AS atrasadas,
      COALESCE(SUM(CASE WHEN "status"='CONCLUIDA' AND "concluidaEm">=date_trunc('month',CURRENT_DATE) THEN 1 ELSE 0 END),0)::int AS "concluidasMes"
    FROM "PessoalTarefa" WHERE "userId"=${u}
  ` as any[]
  // Próximas/atrasadas não concluídas (atrasadas primeiro, depois por prazo).
  const tarefas = await prisma.$queryRaw`
    SELECT "id","titulo","prazo","prioridade","status",
           ("prazo" IS NOT NULL AND "prazo"<CURRENT_DATE) AS atrasada
    FROM "PessoalTarefa" WHERE "userId"=${u} AND "status"<>'CONCLUIDA'
    ORDER BY ("prazo" IS NULL) ASC, "prazo" ASC, "createdAt" DESC LIMIT 6
  ` as any[]

  // ── NOTAS ───────────────────────────────────────────────────────────────
  const notas = await prisma.$queryRaw`
    SELECT "id","titulo", LEFT(COALESCE("conteudo",''),120) AS trecho, "cor", "fixada",
           ("imagem" IS NOT NULL) AS "temImagem"
    FROM "PessoalNota" WHERE "userId"=${u}
    ORDER BY "fixada" DESC, "updatedAt" DESC LIMIT 5
  ` as any[]

  return NextResponse.json(serialize({
    kpis: {
      saldoTotal, receitasMes: Number(mesFin?.receitas || 0), despesasMes: Number(mesFin?.despesas || 0),
      guardadoCaixinhas, tarefasPendentes: Number(tarefasCont?.pendentes || 0), tarefasAtrasadas: Number(tarefasCont?.atrasadas || 0),
    },
    financas: { saldoPorConta, catDespesa, caixinhas, ultimos: ultimos || [] },
    tarefas: { contadores: tarefasCont || { hoje: 0, pendentes: 0, atrasadas: 0, concluidasMes: 0 }, lista: tarefas },
    notas,
  }))
}
