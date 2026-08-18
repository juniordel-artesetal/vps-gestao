// Remover anexo (apaga a linha no Neon). Escopo por userId (só o dono remove).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const n = await prisma.$executeRaw`DELETE FROM "PessoalAnexo" WHERE "id" = ${id} AND "userId" = ${g.userId}`
  if (!n) return NextResponse.json({ error: 'Anexo não encontrado' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
