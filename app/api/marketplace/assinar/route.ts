// Assinatura paga do módulo Marketplaces (R$ 19,90/mês via Asaas). ADMIN + módulo técnico on.
//   GET  → estado da assinatura/entitlement (para o upsell).
//   POST → cria/reusa a assinatura Asaas e devolve o link da fatura (Pix/cartão hospedado).
// NÃO libera o módulo aqui — só o webhook de pagamento confirmado libera.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { integracoesTecnicoAtivo } from '@/lib/marketplace/modulo'
import { statusMarketplace, ativarAssinaturaMarketplaces, MARKETPLACES_PRECO_MENSAL } from '@/lib/marketplace/assinatura'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!integracoesTecnicoAtivo()) return NextResponse.json({ disponivel: false })
  const s = await statusMarketplace(session.user.workspaceId)
  return NextResponse.json({ disponivel: true, preco: MARKETPLACES_PRECO_MENSAL, ...s })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  if (!integracoesTecnicoAtivo()) return NextResponse.json({ error: 'Módulo indisponível.' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const cpf = String(body?.cpf ?? '').trim()
  if (!cpf) return NextResponse.json({ error: 'Informe o CPF do titular para a cobrança.' }, { status: 400 })

  // Nome/e-mail do titular (proprietária do ateliê / admin logada).
  const [u] = await prisma.$queryRaw`
    SELECT COALESCE(w."nomeProprietaria", u."nome") AS nome, LOWER(u."email") AS email
    FROM "User" u JOIN "Workspace" w ON w."id" = u."workspaceId"
    WHERE u."id" = ${session.user.id} LIMIT 1
  ` as { nome: string | null; email: string | null }[]

  const r = await ativarAssinaturaMarketplaces(session.user.workspaceId, {
    nome: u?.nome ?? session.user.name ?? 'Assinante SOA',
    email: u?.email ?? session.user.email ?? null,
    cpf,
  })
  if (!r.ok) return NextResponse.json({ error: r.erro || 'Não foi possível iniciar a assinatura.' }, { status: 400 })
  return NextResponse.json({ ok: true, jaAtiva: r.jaAtiva ?? false, status: r.status, invoiceUrl: r.invoiceUrl ?? null })
}
