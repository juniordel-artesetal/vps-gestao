import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const workspaceId = session.user.workspaceId

    const todos = await prisma.$queryRaw`
      SELECT "status", "prioridade", "canal"
      FROM "Order"
      WHERE "workspaceId" = ${workspaceId}
    ` as any[]

    const total      = todos.length
    const abertos    = todos.filter(p => p.status === 'ABERTO').length
    const emProducao = todos.filter(p => p.status === 'EM_PRODUCAO').length
    const concluidos = todos.filter(p => p.status === 'CONCLUIDO').length
    const cancelados = todos.filter(p => p.status === 'CANCELADO').length

    // Por prioridade (só abertos e em produção)
    const ativos = todos.filter(p => !['CONCLUIDO','CANCELADO'].includes(p.status))
    const porPrioridadeMap: Record<string, number> = {}
    ativos.forEach(p => {
      const pri = p.prioridade || 'NORMAL'
      porPrioridadeMap[pri] = (porPrioridadeMap[pri] || 0) + 1
    })
    const porPrioridade = Object.entries(porPrioridadeMap).map(([prioridade, total]) => ({ prioridade, total }))

    // Por canal
    const porCanalMap: Record<string, number> = {}
    todos.filter(p => p.canal).forEach(p => {
      porCanalMap[p.canal] = (porCanalMap[p.canal] || 0) + 1
    })
    const porCanal = Object.entries(porCanalMap)
      .map(([canal, total]) => ({ canal, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    // Recentes
    const recentes = await prisma.$queryRaw`
      SELECT "id", "numero", "destinatario", "produto", "status",
             "prioridade", "canal", "dataEnvio", "createdAt"
      FROM "Order"
      WHERE "workspaceId" = ${workspaceId}
      ORDER BY "createdAt" DESC
      LIMIT 5
    ` as any[]

    return NextResponse.json({
      totais: { total, abertos, em_producao: emProducao, concluidos, cancelados },
      porPrioridade,
      porCanal,
      recentes,
    })
  } catch (error) {
    console.error('Erro resumo:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
