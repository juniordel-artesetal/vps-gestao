// Selo/cortesia do workspace da sessão (pro app da artesã mostrar "✨ Parceira Influenciadora").
// Isolado de propósito: garante as colunas aqui, sem tocar no hot path /api/config/geral.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { garantirColunasInfluenciadora } from '@/lib/influenciadora'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ selo: null })
  try {
    await garantirColunasInfluenciadora()
    const [w] = await prisma.$queryRaw`
      SELECT "selo", ("cortesiaAtivadaEm" IS NOT NULL AND "liberacaoManual" = true) AS "cortesiaAtiva"
      FROM "Workspace" WHERE "id" = ${session.user.workspaceId} LIMIT 1
    ` as { selo: string | null; cortesiaAtiva: boolean }[]
    return NextResponse.json({ selo: w?.selo ?? null, cortesiaAtiva: !!w?.cortesiaAtiva })
  } catch (e) {
    console.error('[INFLU selo]', (e as Error)?.message)
    return NextResponse.json({ selo: null })
  }
}
