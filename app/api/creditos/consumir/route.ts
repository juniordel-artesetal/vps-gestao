import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { consumir } from '@/lib/creditos'

export const dynamic = 'force-dynamic'

// POST — consome créditos de um tipo (chamado pelas features: NF, foto…). Atômico e idempotente.
// body: { tipo: string, qtd?: number, referencia?: string }
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const workspaceId = session.user.workspaceId
    const body = await req.json().catch(() => ({}))
    const tipo = String(body.tipo || '').trim()
    const qtd = Number(body.qtd) || 1
    const referencia = body.referencia ? String(body.referencia) : null

    if (!tipo) return NextResponse.json({ error: 'Tipo obrigatório' }, { status: 400 })

    const r = await consumir({ workspaceId, tipo, qtd, referencia })
    if (!r.ok) {
      // Saldo insuficiente vira 402 (feature oferece comprar pacote); demais 400
      const status = r.faltam !== undefined ? 402 : 400
      return NextResponse.json(r, { status })
    }
    return NextResponse.json(r)
  } catch (error) {
    console.error('[CREDITOS] consumir:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
