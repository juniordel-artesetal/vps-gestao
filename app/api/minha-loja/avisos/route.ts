// Avisos de novo pedido da loja (chamado Y20A): estado agregado p/ Sofia + pop-up, "visto" e config dos canais.
// Escopado pelo workspaceId da sessão. GET nunca falha (fail-open → zero avisos).
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { estadoAvisos, marcarVistos, marcarPopupVisto, salvarConfig } from '@/lib/loja/avisosPedido'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role === 'OPERADOR') return NextResponse.json({ novos: 0, mostrarPopup: false, config: null })
  return NextResponse.json(await estadoAvisos(session.user.workspaceId))
}

// POST { acao: 'visto' | 'popupVisto' | 'config', emailAtivo?, sofiaAtivo?, popupAtivo? }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId
  const b = await req.json().catch(() => ({}))

  if (b?.acao === 'visto') { await marcarVistos(workspaceId); return NextResponse.json({ ok: true }) }
  if (b?.acao === 'popupVisto') { await marcarPopupVisto(workspaceId); return NextResponse.json({ ok: true }) }
  if (b?.acao === 'config') {
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Só a administradora muda os avisos' }, { status: 403 })
    try {
      await salvarConfig(workspaceId, { emailAtivo: b.emailAtivo !== false, sofiaAtivo: b.sofiaAtivo !== false, popupAtivo: b.popupAtivo !== false })
      return NextResponse.json({ ok: true })
    } catch (e) {
      console.error('[MINHA-LOJA avisos config]', e)
      return NextResponse.json({ error: 'Não consegui salvar agora. Tente de novo.' }, { status: 500 })
    }
  }
  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}
