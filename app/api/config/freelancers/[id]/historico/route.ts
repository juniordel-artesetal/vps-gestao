// app/api/config/freelancers/[id]/historico/route.ts
// Retorna histórico de demandas + pedidos vinculados à freelancer
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id: freelancerId } = await params
  const workspaceId = session.user.workspaceId

  // Verifica que freelancer pertence ao workspace
  const fre = await prisma.$queryRaw`
    SELECT id, nome FROM "Freelancer"
    WHERE id = ${freelancerId} AND "workspaceId" = ${workspaceId}
    LIMIT 1
  ` as any[]
  if (!fre.length) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  // Demandas da freelancer
  const demandas = await prisma.$queryRaw`
    SELECT
      d.id, d."nomeProduto", d."qtdSolicitada"::int, d."qtdProduzida"::int,
      d."valorPorItem", d."valorTotal", d.status, d."dataPagamento", d."createdAt",
      COALESCE('#' || o.numero, d."pedidoId") AS "pedidoRef"
    FROM "Demanda" d
    LEFT JOIN "Order" o ON o.id = d."pedidoId"
    WHERE d."freelancerId" = ${freelancerId}
      AND d."workspaceId"  = ${workspaceId}
    ORDER BY d."createdAt" DESC
  ` as any[]

  // Pedidos vinculados via camposExtras._freelancers
  const pedidos = await prisma.$queryRaw`
    SELECT
      o.id, o.numero, o.destinatario, o.produto,
      o.quantidade::int, o.valor, o.status,
      o."dataEntrada", o."dataEnvio", o."camposExtras"
    FROM "Order" o
    WHERE o."workspaceId" = ${workspaceId}
      AND o."camposExtras"::text LIKE ${'%' + freelancerId + '%'}
    ORDER BY o."createdAt" DESC
  ` as any[]

  // Filtra só os que têm a freelancer no _freelancers
  const pedidosVinculados = pedidos.filter((p: any) => {
    try {
      const extras = JSON.parse(p.camposExtras || '{}')
      const fl = extras._freelancers || {}
      return Object.keys(fl).includes(freelancerId)
    } catch { return false }
  })

  const demandasSer = serialize(demandas)
  const totalPago   = demandasSer.filter((d: any) => d.status === 'PAGO').reduce((s: number, d: any) => s + (d.valorTotal || 0), 0)
  const totalPendente = demandasSer.filter((d: any) => d.status !== 'PAGO').reduce((s: number, d: any) => s + ((d.valorPorItem || 0) * (d.qtdSolicitada || 0)), 0)
  const totalItens  = demandasSer.reduce((s: number, d: any) => s + (d.qtdSolicitada || 0), 0)

  return NextResponse.json({
    freelancer: serialize(fre[0]),
    demandas:   demandasSer,
    pedidos:    serialize(pedidosVinculados),
    stats: { totalPago, totalPendente, totalItens, totalDemandas: demandasSer.length },
  })
}
