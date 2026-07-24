// ─────────────────────────────────────────────────────────────────────────────
// MOTOR DE ALERTAS PROATIVOS DA SOFIA — grounded no estado REAL do workspace.
//
// Regra de ouro: só entra na lista o alerta que EXISTE de verdade (n > 0). Nada
// genérico, nada de "está tudo em dia" como alerta. Cada alerta traz contagem +
// frase curta e próxima + LINK para resolver. Prioriza atrasos/contas vencidas.
//
// Reaproveita a definição canônica de "finalizado/atrasado" (statusPedido.ts) — a
// MESMA que o sino do dashboard usa (dashboard/resumo): não-finalizado + dataEnvio
// vencida.
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { sqlFinalizado, workspaceTemExpedicao } from '@/lib/statusPedido'

export interface Alerta {
  tipo: 'pedidos_atrasados' | 'contas_vencidas' | 'contas_hoje' | 'estoque_baixo'
  n: number
  texto: string
  link: string
  prioridade: number // menor = mais urgente
}

export async function calcularAlertas(workspaceId: string): Promise<Alerta[]> {
  const alertas: Alerta[] = []

  // ── Pedidos atrasados (mesmo critério do sino do dashboard) ──
  try {
    const temExp = await workspaceTemExpedicao(workspaceId)
    const finalizado = sqlFinalizado(Prisma.sql`"status"`, temExp)
    const [r] = await prisma.$queryRaw(Prisma.sql`
      SELECT COUNT(*)::int AS n FROM "Order"
      WHERE "workspaceId" = ${workspaceId}
        AND NOT ${finalizado}
        AND "dataEnvio" IS NOT NULL AND "dataEnvio"::date < CURRENT_DATE
    `) as { n: number }[]
    const n = Number(r?.n) || 0
    if (n > 0) alertas.push({
      tipo: 'pedidos_atrasados', n, prioridade: 1,
      texto: n === 1 ? 'Você tem 1 pedido atrasado 🕐' : `Você tem ${n} pedidos atrasados 🕐`,
      link: '/dashboard/pedidos?atrasados=1',
    })
  } catch (e) { console.error('[SOFIA-ALERTAS] atrasados:', (e as Error)?.message) }

  // ── Contas a pagar: vencidas e vencendo hoje (DESPESA pendente) ──
  try {
    // Mesma regra do sino (notificacoes): vencido = não PAGO e data passada.
    const [r] = await prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE "data"::date <  CURRENT_DATE)::int AS vencidas,
        COUNT(*) FILTER (WHERE "data"::date =  CURRENT_DATE)::int AS hoje
      FROM "FinLancamento"
      WHERE "workspaceId" = ${workspaceId} AND "tipo" = 'DESPESA' AND "status" <> 'PAGO'
        AND "data"::date <= CURRENT_DATE
    ` as { vencidas: number; hoje: number }[]
    const vencidas = Number(r?.vencidas) || 0
    const hoje = Number(r?.hoje) || 0
    if (vencidas > 0) alertas.push({
      tipo: 'contas_vencidas', n: vencidas, prioridade: 0,
      texto: vencidas === 1 ? 'Você tem 1 conta vencida 💸' : `Você tem ${vencidas} contas vencidas 💸`,
      link: '/financeiro/lancamentos',
    })
    if (hoje > 0) alertas.push({
      tipo: 'contas_hoje', n: hoje, prioridade: 2,
      texto: hoje === 1 ? 'Hoje vence 1 conta 💡' : `Hoje vencem ${hoje} contas 💡`,
      link: '/financeiro/lancamentos',
    })
  } catch (e) { console.error('[SOFIA-ALERTAS] contas:', (e as Error)?.message) }

  // ── Estoque de material baixo/zerado (mesma query do sino) ──
  try {
    const [r] = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS n FROM "EstMaterialSaldo" es
      WHERE es."workspaceId" = ${workspaceId}
        AND es."estoqueMinimo" IS NOT NULL AND es."saldoAtual" <= es."estoqueMinimo"
    ` as { n: number }[]
    const n = Number(r?.n) || 0
    if (n > 0) alertas.push({
      tipo: 'estoque_baixo', n, prioridade: 3,
      texto: n === 1 ? '1 material com estoque baixo 📦' : `${n} materiais com estoque baixo 📦`,
      link: '/precificacao/estoque-materiais',
    })
  } catch (e) { console.error('[SOFIA-ALERTAS] estoque:', (e as Error)?.message) }

  return alertas.sort((a, b) => a.prioridade - b.prioridade)
}
