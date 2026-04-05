// app/api/producao/historico/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id: pedidoId } = await params
  const workspaceId = session.user.workspaceId

  try {
    // Busca PedidoSetor com dados dos setores para montar fluxo visual
    const setores = await prisma.$queryRaw`
      SELECT
        ps."setorId",
        sc."nome"        AS "setorNome",
        sc."ordem",
        ps."status",
        ps."iniciadoEm"  AS "entradaEm",
        ps."concluidoEm" AS "saidaEm"
      FROM "PedidoSetor" ps
      JOIN "SetorConfig" sc ON sc."id" = ps."setorId"
      WHERE ps."pedidoId"    = ${pedidoId}
        AND ps."workspaceId" = ${workspaceId}
      ORDER BY sc."ordem" ASC
    ` as any[]

    // Determina setor atual
    const serialized = serialize(setores).map((s: any) => ({
      setorId:   s.setorId,
      setorNome: s.setorNome,
      status:    s.status,
      entradaEm: s.entradaEm,
      saidaEm:   s.saidaEm,
      // "atual" = está em EM_ANDAMENTO ou DEVOLVIDO (pedido está aqui agora)
      atual: s.status === 'EM_ANDAMENTO' || s.status === 'DEVOLVIDO',
    }))

    // Tenta buscar histórico de ações (PedidoHistorico pode não existir ainda)
    let historico: any[] = []
    try {
      const hist = await prisma.$queryRaw`
        SELECT id, tipo, descricao, "usuarioNome", "createdAt"
        FROM "PedidoHistorico"
        WHERE "pedidoId"    = ${pedidoId}
          AND "workspaceId" = ${workspaceId}
        ORDER BY "createdAt" ASC
      ` as any[]
      historico = serialize(hist)
    } catch {}

    return NextResponse.json({
      historico, // array de PedidoHistorico (pode ser vazio)
      fluxo: serialized, // array de SetorHistorico para renderização do fluxo visual
    })
  } catch (err) {
    console.error('[GET /api/producao/historico]', err)
    return NextResponse.json({ historico: [], fluxo: [] })
  }
}
