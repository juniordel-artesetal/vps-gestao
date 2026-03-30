// app/api/dashboard/resumo/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const hoje = new Date()
  const ano  = hoje.getFullYear()
  const mes  = hoje.getMonth() + 1

  // ── 1. PRODUÇÃO — pedidos por status
  const producao: any[] = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS total,
      COUNT(CASE WHEN status = 'ABERTO'      THEN 1 END)::int AS abertos,
      COUNT(CASE WHEN status = 'EM_ANDAMENTO' THEN 1 END)::int AS emAndamento,
      COUNT(CASE WHEN status = 'ENTREGUE'    THEN 1 END)::int AS entregues,
      COUNT(CASE WHEN status = 'CANCELADO'   THEN 1 END)::int AS cancelados,
      COUNT(CASE WHEN status != 'ENTREGUE' AND status != 'CANCELADO'
                  AND "dataEnvio" IS NOT NULL
                  AND "dataEnvio"::date < CURRENT_DATE THEN 1 END)::int AS atrasados
    FROM "Order"
    WHERE "workspaceId" = ${workspaceId}
      AND EXTRACT(YEAR  FROM "createdAt") = ${ano}
      AND EXTRACT(MONTH FROM "createdAt") = ${mes}
  `

  // ── 2. PRODUÇÃO — pedidos últimos 6 meses (para gráfico)
  const producaoTendencia: any[] = await prisma.$queryRaw`
    SELECT
      EXTRACT(YEAR  FROM "createdAt")::int AS ano,
      EXTRACT(MONTH FROM "createdAt")::int AS mes,
      COUNT(*)::int AS total,
      COUNT(CASE WHEN status = 'ENTREGUE' THEN 1 END)::int AS entregues
    FROM "Order"
    WHERE "workspaceId" = ${workspaceId}
      AND "createdAt" >= (CURRENT_DATE - INTERVAL '5 months')::date
    GROUP BY ano, mes ORDER BY ano, mes
  `

  // ── 3. FINANCEIRO — mês atual
  const financeiro: any[] = await prisma.$queryRaw`
    SELECT
      tipo,
      COALESCE(SUM(CASE WHEN status='PAGO' THEN COALESCE("valorRealizado",valor) ELSE 0 END),0)::float AS realizado,
      COALESCE(SUM(CASE WHEN status='PENDENTE' THEN valor ELSE 0 END),0)::float AS pendente
    FROM "FinLancamento"
    WHERE "workspaceId" = ${workspaceId}
      AND EXTRACT(YEAR  FROM data) = ${ano}
      AND EXTRACT(MONTH FROM data) = ${mes}
    GROUP BY tipo
  `

  // ── 4. FINANCEIRO — últimos 6 meses (para gráfico)
  const finTendencia: any[] = await prisma.$queryRaw`
    SELECT
      EXTRACT(YEAR  FROM data)::int AS ano,
      EXTRACT(MONTH FROM data)::int AS mes,
      COALESCE(SUM(CASE WHEN tipo='RECEITA' AND status='PAGO' THEN COALESCE("valorRealizado",valor) ELSE 0 END),0)::float AS receita,
      COALESCE(SUM(CASE WHEN tipo='DESPESA' AND status='PAGO' THEN COALESCE("valorRealizado",valor) ELSE 0 END),0)::float AS despesa
    FROM "FinLancamento"
    WHERE "workspaceId" = ${workspaceId}
      AND status = 'PAGO'
      AND data >= (CURRENT_DATE - INTERVAL '5 months')::date
    GROUP BY ano, mes ORDER BY ano, mes
  `

  // ── 5. PRECIFICAÇÃO — melhores e piores margens
  const produtos: any[] = await prisma.$queryRaw`
    SELECT
      p.nome,
      v.canal,
      v."precoVenda"::float,
      v."custoTotal"::float,
      v.impostos::float,
      CASE WHEN v."precoVenda" > 0
        THEN ROUND(((v."precoVenda" - v."custoTotal") / v."precoVenda" * 100)::numeric, 1)::float
        ELSE 0
      END AS margem
    FROM "PrecVariacao" v
    JOIN "PrecProduto" p ON p.id = v."produtoId"
    WHERE p."workspaceId" = ${workspaceId}
      AND p.ativo = true
      AND v."precoVenda" IS NOT NULL AND v."precoVenda" > 0
    ORDER BY margem DESC
    LIMIT 20
  `

  // ── Montar retorno
  const rec  = financeiro.find(r => r.tipo === 'RECEITA')
  const desp = financeiro.find(r => r.tipo === 'DESPESA')
  const totalReceita = Number(rec?.realizado  || 0)
  const totalDespesa = Number(desp?.realizado || 0)
  const resultado    = totalReceita - totalDespesa
  const margem       = totalReceita > 0 ? (resultado / totalReceita * 100) : 0

  const prod = producao[0] || {}

  // Top 3 melhores e piores margens (sem duplicar produto)
  const produtosUnicos = produtos.filter((p, i, arr) =>
    arr.findIndex(x => x.nome === p.nome) === i
  )
  const melhores = produtosUnicos.slice(0, 3)
  const piores   = [...produtosUnicos].reverse().slice(0, 3)

  const MESES_ABR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

  // Combinar tendências financeiras e de produção em 1 array
  const mesesMap = new Map<string, any>()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    const k = `${d.getFullYear()}-${d.getMonth() + 1}`
    mesesMap.set(k, {
      label: MESES_ABR[d.getMonth()],
      receita: 0, despesa: 0, pedidos: 0, entregues: 0
    })
  }
  for (const r of finTendencia) {
    const k = `${r.ano}-${r.mes}`
    if (mesesMap.has(k)) {
      mesesMap.get(k).receita = Number(r.receita)
      mesesMap.get(k).despesa = Number(r.despesa)
    }
  }
  for (const r of producaoTendencia) {
    const k = `${r.ano}-${r.mes}`
    if (mesesMap.has(k)) {
      mesesMap.get(k).pedidos   = Number(r.total)
      mesesMap.get(k).entregues = Number(r.entregues)
    }
  }

  return NextResponse.json({
    periodo: { ano, mes },
    producao: {
      total:       Number(prod.total       || 0),
      abertos:     Number(prod.abertos     || 0),
      emAndamento: Number(prod.emAndamento || 0),
      entregues:   Number(prod.entregues   || 0),
      cancelados:  Number(prod.cancelados  || 0),
      atrasados:   Number(prod.atrasados   || 0),
    },
    financeiro: {
      totalReceita, totalDespesa, resultado,
      margem: Number(margem.toFixed(1)),
      aReceber: Number(rec?.pendente  || 0),
      aPagar:   Number(desp?.pendente || 0),
    },
    precificacao: {
      totalProdutos: produtosUnicos.length,
      melhores: melhores.map(p => ({ nome: p.nome, canal: p.canal, margem: p.margem, preco: p.precoVenda })),
      piores:   piores.map(p => ({ nome: p.nome, canal: p.canal, margem: p.margem, preco: p.precoVenda })),
    },
    tendencia: Array.from(mesesMap.values()),
  })
}
