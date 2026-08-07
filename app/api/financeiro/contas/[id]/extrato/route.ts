// Extrato de UMA conta bancária: entradas/saídas (lançamentos PAGOS + transferências),
// em ordem, com saldo corrente. Escopo por workspace da sessão.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serialize } from '@/lib/serialize'
import { extratoConta } from '@/lib/finConta'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const ext = await extratoConta(session.user.workspaceId, id)
  if (!ext.conta) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })
  return NextResponse.json(serialize(ext))
}
