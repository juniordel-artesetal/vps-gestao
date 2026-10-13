// Método MAE — CANCELAR a assinatura pela tela (só ADMIN, com confirmação na tela). Apaga a assinatura no Asaas
// (nenhuma cobrança nova; nada é estornado) e o acesso segue até o fim do teste/período pago.
import { recusa } from '@/lib/mae/servidor/acesso'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { cancelarAssinaturaMae } from '@/lib/mae/assinatura/servidor'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getServerSession(authOptions)
  const ws = session?.user.workspaceId
  if (!ws) return recusa('assinatura/cancelar', { error: 'Não autenticado' }, 401)
  if (session.user.role !== 'ADMIN') return recusa('assinatura/cancelar', { error: 'Só a administradora da conta cancela a assinatura' }, 403)
  try {
    const r = await cancelarAssinaturaMae(ws, `tela:${session.user.email ?? session.user.id}`)
    return r.ok ? NextResponse.json(r) : recusa('assinatura/cancelar', { error: r.erro }, 400)
  } catch (e) {
    console.error('[MAE CANCELAR]', e)
    return NextResponse.json({ error: 'Erro ao cancelar' }, { status: 500 })
  }
}
