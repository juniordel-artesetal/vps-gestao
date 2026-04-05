import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const workspaceId = (session.user as any).workspaceId
  const { searchParams } = new URL(req.url)
  const mes = parseInt(searchParams.get('mes') || String(new Date().getMonth() + 1))
  const ano = parseInt(searchParams.get('ano') || String(new Date().getFullYear()))

  const [recRow] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(valor), 0) AS receita
    FROM "FinLancamento"
    WHERE "workspaceId" = ${workspaceId}
      AND tipo = 'RECEITA'
      AND EXTRACT(MONTH FROM data) = ${mes}
      AND EXTRACT(YEAR  FROM data) = ${ano}
  ` as any[]

  const [despRow] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(valor), 0) AS despesas
    FROM "FinLancamento"
    WHERE "workspaceId" = ${workspaceId}
      AND tipo = 'DESPESA'
      AND EXTRACT(MONTH FROM data) = ${mes}
      AND EXTRACT(YEAR  FROM data) = ${ano}
  ` as any[]

  const catRows = await prisma.$queryRaw`
    SELECT fc.nome, COALESCE(SUM(fl.valor), 0) AS total
    FROM "FinLancamento" fl
    JOIN "FinCategoria" fc ON fc.id = fl."categoriaId"
    WHERE fl."workspaceId" = ${workspaceId}
      AND fl.tipo = 'DESPESA'
      AND EXTRACT(MONTH FROM fl.data) = ${mes}
      AND EXTRACT(YEAR  FROM fl.data) = ${ano}
    GROUP BY fc.id, fc.nome
  ` as any[]

  const palavrasCMV = ['material', 'mercadori', 'insumo', 'matéria', 'produto', 'cmv', 'embalagem', 'custo prod']
  let cmv = 0
  let despesasFixas = 0
  for (const cat of catRows) {
    const nome  = (cat.nome || '').toLowerCase()
    const valor = parseFloat(String(cat.total)) || 0
    if (palavrasCMV.some(p => nome.includes(p))) cmv += valor
    else despesasFixas += valor
  }

  const [pedRow] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS qtd
    FROM "Order"
    WHERE "workspaceId" = ${workspaceId}
      AND status IN ('CONCLUIDO', 'ENVIADO')
      AND EXTRACT(MONTH FROM "createdAt") = ${mes}
      AND EXTRACT(YEAR  FROM "createdAt") = ${ano}
  ` as any[]

  return NextResponse.json(serialize({
    receita:        recRow?.receita   || 0,
    despesasTotais: despRow?.despesas || 0,
    cmv,
    despesasFixas,
    qtdPedidos:     pedRow?.qtd       || 0,
  }))
}
