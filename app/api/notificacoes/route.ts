import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const workspaceId = session.user.workspaceId
  const hoje        = new Date().toISOString().slice(0, 10)
  const em3dias     = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
  const em7dias     = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  const notificacoes: any[] = []

  // ── 1. Contas a PAGAR vencendo em até 3 dias
  const aPagar = await prisma.$queryRaw`
    SELECT id, descricao, valor, data
    FROM "FinLancamento"
    WHERE "workspaceId" = ${workspaceId}
      AND tipo = 'DESPESA'
      AND status = 'PENDENTE'
      AND data::text <= ${em3dias}
      AND data::text >= ${hoje}
    ORDER BY data ASC
    LIMIT 5
  ` as any[]

  for (const l of aPagar) {
    const diasRestantes = Math.ceil((new Date(l.data).getTime() - Date.now()) / 86400000)
    notificacoes.push({
      id:      `pagar-${l.id}`,
      tipo:    'PAGAR',
      urgente: diasRestantes <= 1,
      titulo:  diasRestantes === 0 ? 'Conta vence HOJE' : `Conta vence em ${diasRestantes} dia${diasRestantes > 1 ? 's' : ''}`,
      desc:    l.descricao,
      valor:   Number(l.valor),
      data:    l.data,
      href:    '/financeiro/lancamentos',
    })
  }

  // ── 2. Contas a PAGAR VENCIDAS
  const vencidas = await prisma.$queryRaw`
    SELECT id, descricao, valor, data
    FROM "FinLancamento"
    WHERE "workspaceId" = ${workspaceId}
      AND tipo = 'DESPESA'
      AND status = 'PENDENTE'
      AND data::text < ${hoje}
    ORDER BY data ASC
    LIMIT 5
  ` as any[]

  for (const l of vencidas) {
    const diasAtraso = Math.ceil((Date.now() - new Date(l.data).getTime()) / 86400000)
    notificacoes.push({
      id:      `vencida-${l.id}`,
      tipo:    'VENCIDA',
      urgente: true,
      titulo:  `Conta vencida há ${diasAtraso} dia${diasAtraso > 1 ? 's' : ''}`,
      desc:    l.descricao,
      valor:   Number(l.valor),
      data:    l.data,
      href:    '/financeiro/lancamentos',
    })
  }

  // ── 3. Contas a RECEBER vencendo em até 7 dias
  const aReceber = await prisma.$queryRaw`
    SELECT id, descricao, valor, data
    FROM "FinLancamento"
    WHERE "workspaceId" = ${workspaceId}
      AND tipo = 'RECEITA'
      AND status = 'PENDENTE'
      AND data::text <= ${em7dias}
      AND data::text >= ${hoje}
    ORDER BY data ASC
    LIMIT 5
  ` as any[]

  for (const l of aReceber) {
    const diasRestantes = Math.ceil((new Date(l.data).getTime() - Date.now()) / 86400000)
    notificacoes.push({
      id:      `receber-${l.id}`,
      tipo:    'RECEBER',
      urgente: false,
      titulo:  diasRestantes === 0 ? 'Recebimento previsto HOJE' : `Recebimento em ${diasRestantes} dia${diasRestantes > 1 ? 's' : ''}`,
      desc:    l.descricao,
      valor:   Number(l.valor),
      data:    l.data,
      href:    '/financeiro/lancamentos',
    })
  }

  // ── 4. Pedidos ATRASADOS (dataEntrega < hoje, não entregues)
  const atrasados = await prisma.$queryRaw`
    SELECT id, "cliente", produto, "dataEntrega"
    FROM "Order"
    WHERE "workspaceId" = ${workspaceId}
      AND status NOT IN ('ENTREGUE','CANCELADO')
      AND "dataEntrega" IS NOT NULL
      AND "dataEntrega"::text < ${hoje}
    ORDER BY "dataEntrega" ASC
    LIMIT 5
  ` as any[]

  for (const o of atrasados) {
    const diasAtraso = Math.ceil((Date.now() - new Date(o.dataEntrega).getTime()) / 86400000)
    notificacoes.push({
      id:      `atrasado-${o.id}`,
      tipo:    'ATRASADO',
      urgente: true,
      titulo:  `Pedido atrasado ${diasAtraso} dia${diasAtraso > 1 ? 's' : ''}`,
      desc:    `${o.cliente || 'Cliente'} — ${o.produto || 'Produto'}`,
      valor:   null,
      data:    o.dataEntrega,
      href:    `/dashboard/pedidos/${o.id}`,
    })
  }

  // ── 5. Pedidos PERTO DE ATRASAR (dataEntrega em até 2 dias)
  const em2dias = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
  const urgentes = await prisma.$queryRaw`
    SELECT id, "cliente", produto, "dataEntrega"
    FROM "Order"
    WHERE "workspaceId" = ${workspaceId}
      AND status NOT IN ('ENTREGUE','CANCELADO')
      AND "dataEntrega" IS NOT NULL
      AND "dataEntrega"::text >= ${hoje}
      AND "dataEntrega"::text <= ${em2dias}
    ORDER BY "dataEntrega" ASC
    LIMIT 5
  ` as any[]

  for (const o of urgentes) {
    const diasRestantes = Math.ceil((new Date(o.dataEntrega).getTime() - Date.now()) / 86400000)
    notificacoes.push({
      id:      `urgente-${o.id}`,
      tipo:    'URGENTE',
      urgente: diasRestantes === 0,
      titulo:  diasRestantes === 0 ? 'Entrega HOJE!' : `Entrega em ${diasRestantes} dia${diasRestantes > 1 ? 's' : ''}`,
      desc:    `${o.cliente || 'Cliente'} — ${o.produto || 'Produto'}`,
      valor:   null,
      data:    o.dataEntrega,
      href:    `/dashboard/pedidos/${o.id}`,
    })
  }

  // Ordena: urgentes primeiro
  notificacoes.sort((a, b) => (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0))

  return NextResponse.json(serialize({
    notificacoes,
    total: notificacoes.length,
    urgentes: notificacoes.filter(n => n.urgente).length,
  }))
}
