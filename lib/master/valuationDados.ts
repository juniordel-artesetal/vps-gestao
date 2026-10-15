// Os números reais que alimentam o valuation (somente leitura, visão cross-tenant do Master).
import { prisma } from '@/lib/prisma'
import { withRetry } from '@/lib/dbRetry'
import { painelReceitas } from './receitas'
import { calcularValuation } from './valuation'

export async function valuationAtual() {
  const tudo = await painelReceitas({ de: new Date('2020-01-01T00:00:00Z'), ate: new Date(Date.now() + 86400_000), rotulo: 'Desde o início' })
  const [x] = await withRetry(() => prisma.$queryRaw<{ gmv: number; gmv30: number; pedidos: number; pedidos30: number; ateliers: number }[]>`SELECT
    (SELECT COALESCE(SUM("valor"), 0)::float FROM "Order" WHERE "status" IS DISTINCT FROM 'CANCELADO') AS "gmv",
    (SELECT COALESCE(SUM("valor"), 0)::float FROM "Order" WHERE "status" IS DISTINCT FROM 'CANCELADO' AND "createdAt" >= now() - interval '30 days') AS "gmv30",
    (SELECT COUNT(*)::int FROM "Order") AS "pedidos",
    (SELECT COUNT(*)::int FROM "Order" WHERE "createdAt" >= now() - interval '30 days') AS "pedidos30",
    (SELECT COUNT(*)::int FROM "Workspace") AS "ateliers"`, 'valuation')
  // churn mensal observado: cancelamentos/cortes dos últimos 3 meses fechados ÷ assinantes ativos hoje
  const t = tudo.tendencia.slice(-4, -1)
  const churnMes = t.length ? t.reduce((s, m) => s + m.churn, 0) / t.length : 0
  const ativos = tudo.resumo.ativas.total
  return calcularValuation({
    hoje: new Date(), mrr: tudo.comercial.mrr, ativos,
    faturamentoAcumulado: tudo.comercial.faturamento.bruto, faturamentoLiquidoAcumulado: tudo.comercial.faturamento.liquido,
    gmvAcumulado: Number(x.gmv), gmv30d: Number(x.gmv30), pedidos: Number(x.pedidos), pedidos30d: Number(x.pedidos30), ateliers: Number(x.ateliers),
    churnMensalObservado: ativos ? Math.round((churnMes / ativos) * 1000) / 10 : null,
  })
}
