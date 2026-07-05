import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// POST — registra clique num patrocinado (base de billing)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await prisma.$executeRaw`UPDATE "PesquisaPatrocinado" SET "cliques" = "cliques" + 1 WHERE "id" = ${String(id)} AND "ativo" = true`
  return NextResponse.json({ ok: true })
}
