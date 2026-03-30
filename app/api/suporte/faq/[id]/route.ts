import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ── PUT — atualizar FAQ (só ADMIN)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { id } = await params
  const { categoria, pergunta, resposta, ordem, ativo } = await req.json()

  await prisma.$executeRaw`
    UPDATE "SuporteFaq"
    SET
      "categoria" = COALESCE(${categoria ?? null}, "categoria"),
      "pergunta"  = COALESCE(${pergunta ?? null},  "pergunta"),
      "resposta"  = COALESCE(${resposta ?? null},  "resposta"),
      "ordem"     = COALESCE(${ordem ?? null},     "ordem"),
      "ativo"     = COALESCE(${ativo ?? null},     "ativo"),
      "updatedAt" = NOW()
    WHERE "id" = ${id}
  `

  return NextResponse.json({ ok: true })
}

// ── DELETE — remover FAQ (só ADMIN)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { id } = await params

  await prisma.$executeRaw`DELETE FROM "SuporteFaq" WHERE "id" = ${id}`

  return NextResponse.json({ ok: true })
}
