// Tag individual: PUT (renomeia/cor) + DELETE (remove a tag; vínculos caem por cascade).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const b = await req.json().catch(() => ({}))
  const sets: string[] = []
  const vals: any[] = []
  if (typeof b?.nome === 'string' && b.nome.trim()) { sets.push(`"nome" = $${vals.length + 1}`); vals.push(b.nome.trim()) }
  if ('cor' in b) { sets.push(`"cor" = $${vals.length + 1}`); vals.push(b.cor || null) }
  if (!sets.length) return NextResponse.json({ error: 'Nada a atualizar' }, { status: 400 })
  vals.push(id, g.userId)
  const n = await prisma.$executeRawUnsafe(
    `UPDATE "PessoalTag" SET ${sets.join(', ')} WHERE "id" = $${vals.length - 1} AND "userId" = $${vals.length}`,
    ...vals,
  )
  if (!n) return NextResponse.json({ error: 'Tag não encontrada' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const n = await prisma.$executeRaw`DELETE FROM "PessoalTag" WHERE "id" = ${id} AND "userId" = ${g.userId}`
  if (!n) return NextResponse.json({ error: 'Tag não encontrada' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
