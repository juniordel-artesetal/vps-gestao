// GET  → status atual da assinatura Pessoal do usuário logado.
// POST → ativar (coleta CPF) → cria/reusa customer+subscription no Asaas → PENDENTE + link da fatura.
// Escopo por session.user.id (add-on por usuário; NUNCA workspaceId). Segredos nunca saem daqui.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { lerAssinatura, ativarAssinatura, linkFatura, PESSOAL_VALOR } from '@/lib/pessoal/assinatura'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const a = await lerAssinatura(session.user.id)
  // PENDENTE: reanexa o link da fatura (sobrevive a reload da página de ativação).
  let invoiceUrl: string | null = null
  if (a?.status === 'PENDENTE' && a.asaasSubscriptionId) {
    try { invoiceUrl = await linkFatura(a.asaasSubscriptionId) } catch { /* opcional */ }
  }
  return NextResponse.json({
    valor: PESSOAL_VALOR,
    status: a?.status ?? 'NENHUMA',
    proximoVencimento: a?.proximoVencimento ?? null,
    ativadaEm: a?.ativadaEm ?? null,
    invoiceUrl,
  })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const cpf = String(body?.cpf ?? '').trim()
  if (!cpf) return NextResponse.json({ error: 'Informe o CPF.' }, { status: 400 })

  const r = await ativarAssinatura(session.user.id, {
    nome: session.user.name || session.user.email || 'Assinante SOA',
    email: session.user.email || null,
    cpf,
  })
  if (!r.ok) return NextResponse.json({ error: r.erro || 'Falha ao ativar.' }, { status: 400 })
  return NextResponse.json({ ok: true, status: r.status || 'PENDENTE', jaAtiva: !!r.jaAtiva, invoiceUrl: r.invoiceUrl ?? null })
}
