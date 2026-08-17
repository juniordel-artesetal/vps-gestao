import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serialize } from '@/lib/serialize'
import { cancelarAssinatura } from '@/lib/assinatura/cancelar'
import { estadoDaAssinatura } from '@/lib/assinatura'

export const dynamic = 'force-dynamic'

// POST — a própria assinante cancela. body: { motivo? }
//
// Ela mantém o acesso até o fim do período JÁ PAGO. Cortar no instante do
// cancelamento seria ficar com o dinheiro do ciclo sem entregar o serviço.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  // Só a dona (ADMIN) cancela a própria assinatura — funcionárias não encerram a conta.
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Só a administradora da conta pode cancelar a assinatura.' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const r = await cancelarAssinatura({
    workspaceId: session.user.workspaceId,
    por: 'assinante',
    motivo: typeof body.motivo === 'string' ? body.motivo : null,
  })

  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 502 })

  return NextResponse.json(serialize({
    ok: true,
    acessoAte: r.acessoAte,
    estado: await estadoDaAssinatura(session.user.workspaceId),
  }))
}
