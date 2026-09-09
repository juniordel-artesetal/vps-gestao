// Histórico de alteração de UM lançamento (Fase 3) — quem/quando/o quê, para auditoria.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ensureFinHistorico } from '@/lib/finHistorico'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  await ensureFinHistorico()
  const { id } = await params

  const itens = await prisma.$queryRaw`
    SELECT "id", "acao", "descricao",
           "valorAntes"::float AS "valorAntes", "valorDepois"::float AS "valorDepois",
           "statusAntes", "statusDepois", "usuarioNome", "createdAt"
    FROM "FinLancamentoHistorico"
    WHERE "workspaceId" = ${session.user.workspaceId} AND "lancamentoId" = ${id}
    ORDER BY "createdAt" DESC
    LIMIT 100
  ` as any[]

  return NextResponse.json(serialize({ itens }))
}
