// app/api/gestao/contexto/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { searchParams } = new URL(req.url)
  const ano = parseInt(searchParams.get('ano') || String(new Date().getFullYear()))
  const mes = parseInt(searchParams.get('mes') || String(new Date().getMonth() + 1))

  // Calcular mês anterior
  const mesAnt = mes === 1 ? 12 : mes - 1
  const anoAnt = mes === 1 ? ano - 1 : ano

  // ── 1. Dados do workspace (nome, segmento, colaboradores)
  let workspace: any = { nome: 'Meu Negócio', segmento: 'artesanato', colaboradores: null }
  try {
    const ws: any[] = await prisma.$queryRaw`
      SELECT nome, segmento, colaboradores FROM "Workspace" WHERE id=${workspaceId} LIMIT 1
    `
    if (ws[0]) workspace = ws[0]
  } catch { /* workspace pode não ter essas colunas */ }

  // ── 2. Financeiro do mês selecionado
  const finMes: any[] = await prisma.$queryRaw`
    SELECT
      tipo,
      COALESCE(SUM(CASE WHEN status='PAGO' THEN COALESCE("valorRealizado",valor) ELSE 0 END),0)::float AS realizado,
      COALESCE(SUM(CASE WHEN status='PENDENTE' THEN valor ELSE 0 END),0)::float AS pendente,
      COUNT(CASE WHEN status='PAGO' THEN 1 END)::int AS qtdPago
    FROM "FinLancamento"
    WHERE "workspaceId"=${workspaceId}
      AND EXTRACT(YEAR FROM data)=${ano}
      AND EXTRACT(MONTH FROM data)=${mes}
    GROUP BY tipo
  `

  // ── 3. Financeiro do mês ANTERIOR (comparativo)
  const finAnt: any[] = await prisma.$queryRaw`
    SELECT
      tipo,
      COALESCE(SUM(CASE WHEN status='PAGO' THEN COALESCE("valorRealizado",valor) ELSE 0 END),0)::float AS realizado
    FROM "FinLancamento"
    WHERE "workspaceId"=${workspaceId}
      AND EXTRACT(YEAR FROM data)=${anoAnt}
      AND EXTRACT(MONTH FROM data)=${mesAnt}
    GROUP BY tipo
  `

  // ── 4. Tendência últimos 4 meses
  const finTendencia: any[] = await prisma.$queryRaw`
    SELECT
      EXTRACT(YEAR FROM data)::int AS ano,
      EXTRACT(MONTH FROM data)::int AS mes,
      COALESCE(SUM(CASE WHEN tipo='RECEITA' AND status='PAGO' THEN COALESCE("valorRealizado",valor) ELSE 0 END),0)::float AS receita,
      COALESCE(SUM(CASE WHEN tipo='DESPESA' AND status='PAGO' THEN COALESCE("valorRealizado",valor) ELSE 0 END),0)::float AS despesa
    FROM "FinLancamento"
    WHERE "workspaceId"=${workspaceId} AND status='PAGO'
      AND data >= (CURRENT_DATE - INTERVAL '4 months')::date
    GROUP BY ano, mes ORDER BY ano, mes
  `

  // ── 5. Despesas por categoria com percentual
  const despesasCat: any[] = await prisma.$queryRaw`
    SELECT
      COALESCE(c.nome, 'Sem categoria') AS categoria,
      COALESCE(SUM(COALESCE(l."valorRealizado",l.valor)),0)::float AS total
    FROM "FinLancamento" l
    LEFT JOIN "FinCategoria" c ON c.id = l."categoriaId"
    WHERE l."workspaceId"=${workspaceId}
      AND l.tipo='DESPESA' AND l.status='PAGO'
      AND EXTRACT(YEAR FROM l.data)=${ano}
      AND EXTRACT(MONTH FROM l.data)=${mes}
    GROUP BY c.nome ORDER BY total DESC LIMIT 8
  `

  // ── 6. Meta do mês
  const meta: any[] = await prisma.$queryRaw`
    SELECT "metaReceita"::float,"metaDespesa"::float,"metaLucro"::float
    FROM "FinMeta"
    WHERE "workspaceId"=${workspaceId} AND ano=${ano} AND mes=${mes} LIMIT 1
  `

  // ── 7. Produtos e margens
  const produtos: any[] = await prisma.$queryRaw`
    SELECT
      p.nome AS produto, v.canal, v."subOpcao",
      v."custoTotal"::float, v."precoVenda"::float,
      v.impostos::float, v."metaVendas"
    FROM "PrecVariacao" v
    JOIN "PrecProduto" p ON p.id = v."produtoId"
    WHERE p."workspaceId"=${workspaceId} AND p.ativo=true
      AND v."precoVenda" IS NOT NULL AND v."precoVenda" > 0
    ORDER BY v."precoVenda" DESC LIMIT 10
  `

  // ── 8. Config tributária
  const tributo: any[] = await prisma.$queryRaw`
    SELECT regime, "aliquotaPadrao"::float
    FROM "PrecConfigTributaria" WHERE "workspaceId"=${workspaceId} LIMIT 1
  `

  // ── Montar resposta
  const recMes  = finMes.find(r => r.tipo === 'RECEITA')
  const despMes = finMes.find(r => r.tipo === 'DESPESA')
  const recAnt  = finAnt.find(r => r.tipo === 'RECEITA')
  const despAnt = finAnt.find(r => r.tipo === 'DESPESA')

  const totalReceita = Number(recMes?.realizado || 0)
  const totalDespesa = Number(despMes?.realizado || 0)
  const resultado    = totalReceita - totalDespesa
  const margem       = totalReceita > 0 ? (resultado / totalReceita * 100) : 0
  const qtdPedidos   = Number(recMes?.qtdPago || 0)
  const ticketMedio  = qtdPedidos > 0 ? totalReceita / qtdPedidos : 0

  const recAnterior  = Number(recAnt?.realizado || 0)
  const despAnterior = Number(despAnt?.realizado || 0)

  return NextResponse.json({
    periodo: { ano, mes },
    workspace,
    financeiro: {
      totalReceita, totalDespesa, resultado,
      margem: Number(margem.toFixed(1)),
      qtdPedidos,
      ticketMedio: Number(ticketMedio.toFixed(2)),
      aReceber: Number(recMes?.pendente || 0),
      aPagar:   Number(despMes?.pendente || 0),
    },
    mesAnterior: {
      totalReceita: recAnterior,
      totalDespesa: despAnterior,
      resultado: recAnterior - despAnterior,
    },
    meta: meta[0] || null,
    despesasCat,
    tendencia: finTendencia,
    produtos: produtos.map(p => ({
      produto:    p.produto,
      canal:      p.canal || 'shopee',
      subOpcao:   p.subOpcao || 'classico',
      custoTotal: Number(p.custoTotal || 0),
      precoVenda: Number(p.precoVenda || 0),
      impostos:   Number(p.impostos || 0),
      metaVendas: p.metaVendas,
    })),
    tributo: tributo[0] || { regime: 'MEI', aliquotaPadrao: 0 },
  })
}
