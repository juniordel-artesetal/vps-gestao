// app/api/financeiro/fluxo/route.ts
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

  const realizados: any[] = await prisma.$queryRaw`
    SELECT EXTRACT(DAY FROM data)::int AS dia,
      COALESCE(SUM(CASE WHEN tipo='RECEITA' THEN COALESCE("valorRealizado",valor) ELSE 0 END),0)::float AS receita,
      COALESCE(SUM(CASE WHEN tipo='DESPESA' THEN COALESCE("valorRealizado",valor) ELSE 0 END),0)::float AS despesa
    FROM "FinLancamento"
    WHERE "workspaceId"=${workspaceId} AND EXTRACT(YEAR FROM data)=${ano} AND EXTRACT(MONTH FROM data)=${mes} AND status='PAGO'
    GROUP BY dia ORDER BY dia
  `

  const pendentes: any[] = await prisma.$queryRaw`
    SELECT EXTRACT(DAY FROM data)::int AS dia,
      COALESCE(SUM(CASE WHEN tipo='RECEITA' THEN valor ELSE 0 END),0)::float AS "aReceber",
      COALESCE(SUM(CASE WHEN tipo='DESPESA' THEN valor ELSE 0 END),0)::float AS "aPagar"
    FROM "FinLancamento"
    WHERE "workspaceId"=${workspaceId} AND EXTRACT(YEAR FROM data)=${ano} AND EXTRACT(MONTH FROM data)=${mes} AND status='PENDENTE'
    GROUP BY dia ORDER BY dia
  `

  const lancamentos: any[] = await prisma.$queryRaw`
    SELECT l.id,l.tipo,l.descricao,l.valor::float,l."valorRealizado"::float,l.data,l.status,l.canal,
           EXTRACT(DAY FROM l.data)::int AS dia,
           c.nome AS "categoriaNome",c.cor AS "categoriaCor",c.icone AS "categoriaIcone"
    FROM "FinLancamento" l LEFT JOIN "FinCategoria" c ON c.id=l."categoriaId"
    WHERE l."workspaceId"=${workspaceId} AND EXTRACT(YEAR FROM l.data)=${ano} AND EXTRACT(MONTH FROM l.data)=${mes}
    ORDER BY l.data,l."createdAt"
  `

  const diasNoMes = new Date(ano, mes, 0).getDate()
  const realMap   = new Map(realizados.map(r => [r.dia, r]))
  const pendMap   = new Map(pendentes.map(r => [r.dia, r]))

  let saldoAcumulado = 0
  const dias = Array.from({ length: diasNoMes }, (_, i) => {
    const dia      = i + 1
    const r        = realMap.get(dia)
    const p        = pendMap.get(dia)
    const receita  = Number(r?.receita  || 0)
    const despesa  = Number(r?.despesa  || 0)
    const aReceber = Number(p?.aReceber || 0)
    const aPagar   = Number(p?.aPagar   || 0)
    const saldoDia = receita - despesa
    saldoAcumulado += saldoDia
    return { dia, receita, despesa, aReceber, aPagar, saldoDia, saldoAcumulado, lancamentos: lancamentos.filter(l => l.dia === dia) }
  })

  return NextResponse.json({
    ano, mes, diasNoMes,
    totalReceita:  dias.reduce((s, d) => s + d.receita,  0),
    totalDespesa:  dias.reduce((s, d) => s + d.despesa,  0),
    totalAReceber: dias.reduce((s, d) => s + d.aReceber, 0),
    totalAPagar:   dias.reduce((s, d) => s + d.aPagar,   0),
    saldoFinal: saldoAcumulado,
    dias,
  })
}
