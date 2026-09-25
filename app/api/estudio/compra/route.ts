// SOA Edition — comprar pacote(s) de 50 imagens (cobrança AVULSA no Asaas). Devolve o link da
// fatura; o crédito só entra quando o webhook confirma o pagamento.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ctxEstudio } from '@/lib/estudio/ctx'
import { iniciarCompra } from '@/lib/estudio/compra'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const b = await req.json().catch(() => ({}))
  const [u] = await prisma.$queryRaw`
    SELECT COALESCE(w."nomeProprietaria", u."nome") AS nome, LOWER(u."email") AS email
    FROM "User" u JOIN "Workspace" w ON w."id" = u."workspaceId"
    WHERE u."id" = ${c.userId} AND u."workspaceId" = ${c.workspaceId} LIMIT 1
  ` as { nome: string | null; email: string | null }[]
  const r = await iniciarCompra(c.workspaceId, c.userId, {
    pacotes: Number(b.pacotes) || 1, cpf: typeof b.cpf === 'string' ? b.cpf : undefined,
    nome: u?.nome || 'Cliente SOA', email: u?.email || c.email,
  })
  if (!r.ok) return NextResponse.json({ error: r.erro, precisaCpf: r.precisaCpf ?? false }, { status: r.status || 400 })
  return NextResponse.json(r)
}
