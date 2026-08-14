// Editar/excluir categoria pessoal. Escopo por userId.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const b = await req.json().catch(() => ({}))
  await prisma.$executeRaw`
    UPDATE "PessoalCategoria" SET
      "nome" = COALESCE(${b?.nome ? String(b.nome).trim() : null}, "nome"),
      "tipo" = COALESCE(${b?.tipo === 'RECEITA' || b?.tipo === 'DESPESA' ? b.tipo : null}, "tipo"),
      "cor" = ${b?.cor ?? null}, "icone" = ${b?.icone ?? null}
    WHERE "id" = ${id} AND "userId" = ${g.userId}
  `
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  await prisma.$executeRaw`UPDATE "PessoalLancamento" SET "categoriaId" = NULL WHERE "categoriaId" = ${id} AND "userId" = ${g.userId}`
  await prisma.$executeRaw`DELETE FROM "PessoalCategoria" WHERE "id" = ${id} AND "userId" = ${g.userId}`
  return NextResponse.json({ ok: true })
}
