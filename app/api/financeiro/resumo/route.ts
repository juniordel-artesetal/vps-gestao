// app/api/financeiro/resumo/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const MESES_ABR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { searchParams } = new URL(req.url)
  const ano = parseInt(searchParams.get('ano') || String(new Date().getFullYear()))
  const mes = parseInt(searchParams.get('mes') || String(new Date().getMonth() + 1))

  const totaisMes = await prisma.$queryRaw`
    SELECT
      COALESCE(SUM(CASE WHEN tipo='RECEITA' THEN COALESCE("valorRealizado",valor) ELSE 0 END),0)::float AS "totalReceita",
      COALESCE(SUM(CASE WHEN tipo='DESPESA' THEN COALESCE("valorRealizado",valor) ELSE 0 END),0)::float AS "totalDespesa"
    FROM "FinLancamento"
    WHERE "workspaceId"=${workspaceId}
      AND EXTRACT(YEAR  FROM data)=${ano}
      AND EXTRACT(MONTH FROM data)=${mes}
      AND status='PAGO'
  ` as any[]

  const pendentes = await prisma.$queryRaw`
    SELECT
      COALESCE(SUM(CASE WHEN tipo='RECEITA' THEN valor ELSE 0 END),0)::float AS "aReceber",
      COALESCE(SUM(CASE WHEN tipo='DESPESA' THEN valor ELSE 0 END),0)::float AS "aPagar"
    FROM "FinLancamento"
    WHERE "workspaceId"=${workspaceId} AND status='PENDENTE'
  ` as any[]

  const chartRaw: any[] = await prisma.$queryRaw`
    SELECT
      EXTRACT(YEAR  FROM data)::int AS ano,
      EXTRACT(MONTH FROM data)::int AS mes,
      COALESCE(SUM(CASE WHEN tipo='RECEITA' THEN COALESCE("valorRealizado",valor) ELSE 0 END),0)::float AS receita,
      COALESCE(SUM(CASE WHEN tipo='DESPESA' THEN COALESCE("valorRealizado",valor) ELSE 0 END),0)::float AS despesa
    FROM "FinLancamento"
    WHERE "workspaceId"=${workspaceId} AND status='PAGO'
      AND data >= (CURRENT_DATE - INTERVAL '11 months')::date
    GROUP BY ano,mes ORDER BY ano,mes
  `

  const fluxoRaw: any[] = await prisma.$queryRaw`
    SELECT
      EXTRACT(MONTH FROM data)::int AS mes,
      COALESCE(SUM(CASE WHEN tipo='RECEITA' AND status='PAGO'    THEN COALESCE("valorRealizado",valor) ELSE 0 END),0)::float AS receita,
      COALESCE(SUM(CASE WHEN tipo='DESPESA' AND status='PAGO'    THEN COALESCE("valorRealizado",valor) ELSE 0 END),0)::float AS despesa,
      COALESCE(SUM(CASE WHEN tipo='RECEITA' AND status='PENDENTE' THEN valor ELSE 0 END),0)::float AS "aReceber",
      COALESCE(SUM(CASE WHEN tipo='DESPESA' AND status='PENDENTE' THEN valor ELSE 0 END),0)::float AS "aPagar"
    FROM "FinLancamento"
    WHERE "workspaceId"=${workspaceId} AND EXTRACT(YEAR FROM data)=${ano}
    GROUP BY mes ORDER BY mes
  `

  const metaRaw: any[] = await prisma.$queryRaw`
    SELECT "metaReceita"::float,"metaDespesa"::float,"metaLucro"::float
    FROM "FinMeta"
    WHERE "workspaceId"=${workspaceId} AND ano=${ano} AND mes=${mes} LIMIT 1
  `

  const catReceitaRaw: any[] = await prisma.$queryRaw`
    SELECT
      COALESCE(c.nome, 'Sem categoria') AS nome,
      COALESCE(c.cor, '#16a34a')        AS cor,
      COALESCE(c.icone, '💰')           AS icone,
      COALESCE(SUM(COALESCE(l."valorRealizado", l.valor)), 0)::float AS total
    FROM "FinLancamento" l
    LEFT JOIN "FinCategoria" c ON c.id = l."categoriaId"
    WHERE l."workspaceId"=${workspaceId}
      AND l.tipo='RECEITA' AND l.status='PAGO'
      AND EXTRACT(YEAR  FROM l.data)=${ano}
      AND EXTRACT(MONTH FROM l.data)=${mes}
    GROUP BY c.nome, c.cor, c.icone
    ORDER BY total DESC
  `

  const catDespesaRaw: any[] = await prisma.$queryRaw`
    SELECT
      COALESCE(c.nome, 'Sem categoria') AS nome,
      COALESCE(c.cor, '#dc2626')        AS cor,
      COALESCE(c.icone, '💸')           AS icone,
      COALESCE(SUM(COALESCE(l."valorRealizado", l.valor)), 0)::float AS total
    FROM "FinLancamento" l
    LEFT JOIN "FinCategoria" c ON c.id = l."categoriaId"
    WHERE l."workspaceId"=${workspaceId}
      AND l.tipo='DESPESA' AND l.status='PAGO'
      AND EXTRACT(YEAR  FROM l.data)=${ano}
      AND EXTRACT(MONTH FROM l.data)=${mes}
    GROUP BY c.nome, c.cor, c.icone
    ORDER BY total DESC
  `

  const tr = Number(totaisMes[0]?.totalReceita || 0)
  const td = Number(totaisMes[0]?.totalDespesa || 0)
  const resultado = tr - td
  const margem = tr > 0 ? (resultado / tr) * 100 : 0

  const chart = chartRaw.map(r => ({
    label: MESES_ABR[Number(r.mes) - 1],
    receita: Number(r.receita), despesa: Number(r.despesa),
    resultado: Number(r.receita) - Number(r.despesa),
  }))

  const fluxoMap = new Map(fluxoRaw.map(r => [Number(r.mes), r]))
  let acumulado = 0
  const fluxo = MESES_ABR.map((label, i) => {
    const m    = fluxoMap.get(i + 1)
    const rec  = Number(m?.receita   || 0)
    const desp = Number(m?.despesa   || 0)
    const res  = rec - desp
    acumulado += res
    return { label, mes: i + 1, receita: rec, despesa: desp, resultado: res, acumulado, aReceber: Number(m?.aReceber || 0), aPagar: Number(m?.aPagar || 0) }
  })

  return NextResponse.json({
    totalReceita: tr, totalDespesa: td, resultado,
    margem: Number(margem.toFixed(1)),
    aReceber: Number(pendentes[0]?.aReceber || 0),
    aPagar:   Number(pendentes[0]?.aPagar   || 0),
    meta: metaRaw[0] || null,
    chart, fluxo,
    catReceita: catReceitaRaw.map(r => ({ nome: r.nome, cor: r.cor, icone: r.icone, total: Number(r.total) })),
    catDespesa: catDespesaRaw.map(r => ({ nome: r.nome, cor: r.cor, icone: r.icone, total: Number(r.total) })),
  })
}
