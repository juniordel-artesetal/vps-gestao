// SOA Edition — assinatura dos Templates Especiais (self-service). Só o webhook de pagamento libera.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assinarEspeciais, statusEspeciais } from '@/lib/estudio/especiais'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  return NextResponse.json(await statusEspeciais(session.user.workspaceId))
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const [u] = await prisma.$queryRaw`
    SELECT COALESCE(w."nomeProprietaria", u."nome") AS nome, LOWER(u."email") AS email
    FROM "User" u JOIN "Workspace" w ON w."id" = u."workspaceId" WHERE u."id" = ${session.user.id} LIMIT 1
  ` as { nome: string | null; email: string | null }[]
  const r = await assinarEspeciais(session.user.workspaceId, session.user.id, {
    nome: u?.nome ?? session.user.name ?? 'Assinante SOA', email: u?.email ?? session.user.email ?? null, cpf: typeof b.cpf === 'string' ? b.cpf : undefined,
  })
  if (!r.ok) return NextResponse.json({ error: r.erro, precisaCpf: r.precisaCpf ?? false }, { status: r.status || 400 })
  return NextResponse.json(r)
}
