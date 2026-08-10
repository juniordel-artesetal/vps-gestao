import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serialize } from '@/lib/serialize'
import { saldos, historico } from '@/lib/creditos'

export const dynamic = 'force-dynamic'

// GET — saldo por tipo (com cota grátis do mês) + histórico do workspace da sessão
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const workspaceId = session.user.workspaceId
    const { searchParams } = new URL(req.url)
    const tipo = searchParams.get('tipo')

    const [listaSaldos, ledger] = await Promise.all([
      saldos(workspaceId),
      historico(workspaceId, tipo, 100),
    ])
    return NextResponse.json(serialize({ saldos: listaSaldos, historico: ledger }))
  } catch (error) {
    console.error('[CREDITOS] GET:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
