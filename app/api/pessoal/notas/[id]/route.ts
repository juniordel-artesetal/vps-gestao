// Editar (autosave/pin/cor) e excluir nota pessoal. Escopo por userId.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const b = await req.json().catch(() => ({}))

  // Toggle rápido de pin.
  if (b?.fixada !== undefined && b?.titulo === undefined && b?.conteudo === undefined && b?.cor === undefined) {
    await prisma.$executeRaw`UPDATE "PessoalNota" SET "fixada" = ${!!b.fixada}, "updatedAt" = NOW() WHERE "id" = ${id} AND "userId" = ${g.userId}`
    return NextResponse.json({ ok: true })
  }

  await prisma.$executeRaw`
    UPDATE "PessoalNota" SET
      "titulo" = ${b?.titulo !== undefined ? (String(b.titulo).trim() || null) : null},
      "conteudo" = ${b?.conteudo !== undefined ? (String(b.conteudo) || null) : null},
      "cor" = ${b?.cor ?? null},
      "fixada" = COALESCE(${b?.fixada === undefined ? null : !!b.fixada}::boolean, "fixada"),
      "updatedAt" = NOW()
    WHERE "id" = ${id} AND "userId" = ${g.userId}
  `
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  await prisma.$executeRaw`DELETE FROM "PessoalNota" WHERE "id" = ${id} AND "userId" = ${g.userId}`
  return NextResponse.json({ ok: true })
}
