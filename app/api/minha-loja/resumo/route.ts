import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

// GET — KPIs da loja (Orders canal 'Loja'), workspace-scoped, período em dias.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { searchParams } = new URL(req.url)
  const diasRaw = Number(searchParams.get('dias'))
  const dias = [7, 30, 90, 365].includes(diasRaw) ? diasRaw : 30

  // KPIs numéricos (SQL, com cast) — sem SELECT *
  const [kpi] = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS "nPedidos",
      COALESCE(SUM("valor"), 0)::float AS "faturamentoTotal",
      COALESCE(SUM("valor") FILTER (WHERE "statusPagamento" = 'pago'), 0)::float AS "faturamentoPago",
      COUNT(*) FILTER (WHERE "statusPagamento" = 'pago')::int AS "nPagos",
      COUNT(*) FILTER (WHERE "statusPagamento" = 'aguardando')::int AS "nAguardando"
    FROM "Order"
    WHERE "workspaceId" = $1 AND "canal" = 'Loja'
      AND "createdAt" >= NOW() - ($2::int || ' days')::interval
  `, workspaceId, dias) as any[]

  const nPedidos = Number(kpi?.nPedidos || 0)
  const faturamentoTotal = Number(kpi?.faturamentoTotal || 0)
  const ticketMedio = nPedidos > 0 ? faturamentoTotal / nPedidos : 0

  // Últimos pedidos
  const ultimos = await prisma.$queryRawUnsafe(`
    SELECT "id","numero","destinatario","valor"::float AS "valor","status",
           "statusPagamento","metodoPagamento","createdAt"
    FROM "Order"
    WHERE "workspaceId" = $1 AND "canal" = 'Loja'
    ORDER BY "createdAt" DESC
    LIMIT 10
  `, workspaceId) as any[]

  // Mais vendidos — agrega camposExtras.produtos dos pedidos do período (cap 500)
  const comExtras = await prisma.$queryRawUnsafe(`
    SELECT "camposExtras"
    FROM "Order"
    WHERE "workspaceId" = $1 AND "canal" = 'Loja'
      AND "createdAt" >= NOW() - ($2::int || ' days')::interval
    ORDER BY "createdAt" DESC
    LIMIT 500
  `, workspaceId, dias) as { camposExtras: string | null }[]

  const contagem = new Map<string, { nome: string; qtd: number }>()
  for (const row of comExtras) {
    let prods: any[] = []
    try { prods = JSON.parse(row.camposExtras || '{}')?.produtos || [] } catch {}
    for (const p of prods) {
      const nome = String(p?.nome || '').trim()
      if (!nome) continue
      const q = Number(p?.quantidade) || 1
      const cur = contagem.get(nome) || { nome, qtd: 0 }
      cur.qtd += q
      contagem.set(nome, cur)
    }
  }
  const maisVendidos = Array.from(contagem.values()).sort((a, b) => b.qtd - a.qtd).slice(0, 8)

  return NextResponse.json(serialize({
    dias,
    kpis: {
      nPedidos,
      faturamentoTotal,
      faturamentoPago: Number(kpi?.faturamentoPago || 0),
      nPagos: Number(kpi?.nPagos || 0),
      nAguardando: Number(kpi?.nAguardando || 0),
      ticketMedio,
    },
    ultimos,
    maisVendidos,
  }))
}
