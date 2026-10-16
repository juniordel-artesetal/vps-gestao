// TROCA DO SOA MENSAL → ANUAL (self-service). GET: pode trocar? (motivo, vencimento da mensal, tabela do anual 1–12×).
// POST { parcelas }: abre o checkout do anual com a 1ª cobrança no vencimento da mensal (sem cobrança dupla — ver
// lib/assinatura/migracaoAnual.ts). Só a ADMIN da conta.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { estadoMigracao, criarCheckoutMigracao } from '@/lib/assinatura/migracaoAnual'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  const ws = session?.user.workspaceId
  if (!ws) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  try {
    const e = await estadoMigracao(ws)
    return NextResponse.json({ ...e, admin: session.user.role === 'ADMIN' })
  } catch (e) {
    console.error('[MIGRACAO ANUAL GET]', e)
    return NextResponse.json({ error: 'Erro ao ler a sua assinatura' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const ws = session?.user.workspaceId
  if (!ws) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Só a administradora da conta troca o plano' }, { status: 403 })
  const b = await req.json().catch(() => ({})) as { parcelas?: unknown }
  try {
    const r = await criarCheckoutMigracao({ workspaceId: ws, parcelas: Math.max(1, Math.min(12, Math.floor(Number(b.parcelas) || 1))), baseUrl: new URL(req.url).origin })
    return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.erro }, { status: r.status })
  } catch (e) {
    console.error('[MIGRACAO ANUAL POST]', e)
    return NextResponse.json({ error: 'Erro ao abrir o pagamento' }, { status: 500 })
  }
}
