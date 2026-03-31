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
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const workspaceId = session.user.workspaceId
    const hoje = new Date()
    const em7dias = new Date(hoje)
    em7dias.setDate(em7dias.getDate() + 7)
    const hojeFmt = hoje.toISOString().split('T')[0]
    const em7Fmt  = em7dias.toISOString().split('T')[0]
    const notificacoes: any[] = []
    try {
      const vencidos = await prisma.$queryRaw`SELECT l."id", l."descricao", l."valor", l."data", l."tipo" FROM "FinLancamento" l WHERE l."workspaceId" = ${workspaceId} AND l."status" != 'PAGO' AND l."data" < ${hojeFmt}::date ORDER BY l."data" ASC LIMIT 5` as any[]
      for (const l of vencidos) notificacoes.push({ tipo: 'lancamento_vencido', urgencia: 'critica', titulo: `${l.tipo === 'DESPESA' ? 'Despesa' : 'Receita'} vencida`, descricao: `${l.descricao} — R$ ${Number(l.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, href: '/financeiro/lancamentos' })
    } catch {}
    try {
      const aVencer = await prisma.$queryRaw`SELECT l."id", l."descricao", l."valor", l."data", l."tipo" FROM "FinLancamento" l WHERE l."workspaceId" = ${workspaceId} AND l."status" != 'PAGO' AND l."data" >= ${hojeFmt}::date AND l."data" <= ${em7Fmt}::date ORDER BY l."data" ASC LIMIT 5` as any[]
      for (const l of aVencer) notificacoes.push({ tipo: 'lancamento_a_vencer', urgencia: 'media', titulo: `Vence em ${new Date(l.data).toLocaleDateString('pt-BR')}`, descricao: `${l.descricao} — R$ ${Number(l.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, href: '/financeiro/lancamentos' })
    } catch {}
    try {
      const atrasados = await prisma.$queryRaw`SELECT o."id", o."numero", o."destinatario", o."dataEnvio" FROM "Order" o WHERE o."workspaceId" = ${workspaceId} AND o."status" NOT IN ('CONCLUIDO','CANCELADO') AND o."dataEnvio" IS NOT NULL AND o."dataEnvio" < ${hojeFmt}::date ORDER BY o."dataEnvio" ASC LIMIT 5` as any[]
      for (const p of atrasados) notificacoes.push({ tipo: 'pedido_atrasado', urgencia: 'alta', titulo: `Pedido atrasado: ${p.destinatario}`, descricao: `#${p.numero} — envio previsto para ${new Date(p.dataEnvio).toLocaleDateString('pt-BR')}`, href: `/dashboard/pedidos/${p.id}` })
    } catch {}
    try {
      const estoqueBaixo = await prisma.$queryRaw`SELECT em."materialNome", em."saldoAtual", em."estoqueMinimo", em."unidade" FROM "EstMaterialSaldo" em WHERE em."workspaceId" = ${workspaceId} AND em."estoqueMinimo" IS NOT NULL AND em."saldoAtual" <= em."estoqueMinimo" ORDER BY em."saldoAtual" ASC LIMIT 5` as any[]
      for (const e of estoqueBaixo) { const saldo = Number(e.saldoAtual); const minimo = Number(e.estoqueMinimo); const zerado = saldo <= 0; notificacoes.push({ tipo: zerado ? 'estoque_zerado' : 'estoque_baixo', urgencia: zerado ? 'critica' : 'alta', titulo: zerado ? `Estoque zerado: ${e.materialNome}` : `Estoque baixo: ${e.materialNome}`, descricao: zerado ? `Sem unidades em estoque.` : `Saldo: ${saldo.toLocaleString('pt-BR')} ${e.unidade || ''} (mínimo: ${minimo.toLocaleString('pt-BR')})`, href: '/precificacao/estoque-materiais' }) }
    } catch {}
    return NextResponse.json(serialize(notificacoes))
  } catch (error) {
    console.error('Erro notificacoes:', error)
    return NextResponse.json([])
  }
}