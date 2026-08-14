// Editar/excluir uma conta pessoal. Escopo por userId.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, parseNum } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const b = await req.json().catch(() => ({}))
  await prisma.$executeRaw`
    UPDATE "PessoalConta" SET
      "nome" = COALESCE(${b?.nome ? String(b.nome).trim() : null}, "nome"),
      "tipo" = ${b?.tipo ?? null},
      "instituicao" = ${b?.instituicao ?? null},
      "saldoInicial" = ${b?.saldoInicial !== undefined ? parseNum(b.saldoInicial) : null}::numeric,
      "cor" = ${b?.cor ?? null},
      "ativo" = COALESCE(${b?.ativo === undefined ? null : !!b.ativo}::boolean, "ativo")
    WHERE "id" = ${id} AND "userId" = ${g.userId}
  `
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  // Desvincula lançamentos antes de excluir (não apaga histórico financeiro).
  await prisma.$executeRaw`UPDATE "PessoalLancamento" SET "contaId" = NULL WHERE "contaId" = ${id} AND "userId" = ${g.userId}`
  await prisma.$executeRaw`DELETE FROM "PessoalConta" WHERE "id" = ${id} AND "userId" = ${g.userId}`
  return NextResponse.json({ ok: true })
}
