// Subtarefa individual: PUT (concluir/renomear/ordem) + DELETE. Escopo por userId.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const b = await req.json().catch(() => ({}))
  const sets: string[] = []
  const vals: any[] = []
  if (typeof b?.titulo === 'string' && b.titulo.trim()) { sets.push(`"titulo" = $${vals.length + 1}`); vals.push(b.titulo.trim()) }
  if ('concluida' in b) { sets.push(`"concluida" = $${vals.length + 1}`); vals.push(!!b.concluida) }
  if ('ordem' in b) { sets.push(`"ordem" = $${vals.length + 1}`); vals.push(Number(b.ordem) || 0) }
  if (!sets.length) return NextResponse.json({ error: 'Nada a atualizar' }, { status: 400 })
  vals.push(id, g.userId)
  const n = await prisma.$executeRawUnsafe(
    `UPDATE "PessoalSubtarefa" SET ${sets.join(', ')} WHERE "id" = $${vals.length - 1} AND "userId" = $${vals.length}`,
    ...vals,
  )
  if (!n) return NextResponse.json({ error: 'Subtarefa não encontrada' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const n = await prisma.$executeRaw`DELETE FROM "PessoalSubtarefa" WHERE "id" = ${id} AND "userId" = ${g.userId}`
  if (!n) return NextResponse.json({ error: 'Subtarefa não encontrada' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
