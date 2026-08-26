// Cancelar pedido de compra (Feature 2): status CANCELADA + remove lançamentos vinculados
// (despesa da compra + frete terceirizado) + reverte estoque. Transação, idempotente, auditado.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serialize } from '@/lib/serialize'
import { cancelarPedidoCompra } from '@/lib/compras'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Compra inválida' }, { status: 400 })

  try {
    const r = await cancelarPedidoCompra(session.user.workspaceId, id, session.user.name || null)
    if (r.naoEncontrada) return NextResponse.json({ error: 'Compra não encontrada' }, { status: 404 })
    return NextResponse.json(serialize(r))
  } catch (e: any) {
    console.error('[COMPRAS] cancelar:', e)
    return NextResponse.json({ error: e?.message || 'Erro ao cancelar a compra.' }, { status: 400 })
  }
}
