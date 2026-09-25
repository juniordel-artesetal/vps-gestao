// SOA Edition — assinatura do MÓDULO (ESTUDIO_MODULO_PRECO via Asaas). Fica FORA do ctxEstudio: quem ainda
// não tem o módulo precisa ver o status e conseguir assinar.
//   GET  → status do módulo (ativo/origem/assinatura) + uso do dia e créditos do login.
//   POST → assina ou renova: cria/reusa a assinatura no Asaas e devolve o link da fatura.
// Só o webhook de pagamento confirmado libera o módulo.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { statusModuloEstudio, assinarEstudio } from '@/lib/estudio/assinatura'
import { statusCota } from '@/lib/estudio/cota'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const modulo = await statusModuloEstudio(session.user.workspaceId)
  const cota = await statusCota(session.user.workspaceId, session.user.id)
  return NextResponse.json({ ...modulo, cota })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const [u] = await prisma.$queryRaw`
    SELECT COALESCE(w."nomeProprietaria", u."nome") AS nome, LOWER(u."email") AS email
    FROM "User" u JOIN "Workspace" w ON w."id" = u."workspaceId"
    WHERE u."id" = ${session.user.id} LIMIT 1
  ` as { nome: string | null; email: string | null }[]
  const r = await assinarEstudio(session.user.workspaceId, session.user.id, {
    nome: u?.nome ?? session.user.name ?? 'Assinante SOA', email: u?.email ?? session.user.email ?? null,
    cpf: typeof b.cpf === 'string' ? b.cpf : undefined,
  })
  if (!r.ok) return NextResponse.json({ error: r.erro, precisaCpf: r.precisaCpf ?? false }, { status: r.status || 400 })
  return NextResponse.json(r)
}
