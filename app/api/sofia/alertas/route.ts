// Alertas proativos da Sofia — grounded no estado real do workspace (só o que
// EXISTE de verdade). Read-only, escopado pela sessão. Alimenta o painel curto no
// login e o badge do widget.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { calcularAlertas } from '@/lib/sofia/alertas'
import { emailReengajamentoRecente } from '@/lib/reengajamento'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const alertas = await calcularAlertas(session.user.workspaceId)
  // Coerência Sofia↔e-mail: se mandei e-mail nas últimas 48h, a Sofia reconhece no login.
  const emailRecente = await emailReengajamentoRecente(session.user.id)
  return NextResponse.json({ alertas, total: alertas.reduce((s, a) => s + a.n, 0), emailRecente })
}
