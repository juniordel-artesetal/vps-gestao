// Token de assinatura da agenda (feed webcal). GET consulta o ativo; POST gera novo (revoga o antigo);
// DELETE revoga. Escopo userId. O feed é servido em /api/pessoal/agenda/feed/[token] (público-por-token).
import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { guardPessoal, gid, serialize } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

async function tokenAtivo(userId: string): Promise<string | null> {
  const [r] = await prisma.$queryRaw`SELECT "token" FROM "PessoalAgendaToken" WHERE "userId" = ${userId} AND "ativo" = true ORDER BY "createdAt" DESC LIMIT 1` as { token: string }[]
  return r?.token ?? null
}

export async function GET() {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  return NextResponse.json(serialize({ token: await tokenAtivo(g.userId) }))
}

export async function POST() {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const token = crypto.randomBytes(24).toString('hex')
  await prisma.$transaction([
    prisma.$executeRaw`UPDATE "PessoalAgendaToken" SET "ativo" = false, "revogadoEm" = NOW() WHERE "userId" = ${g.userId} AND "ativo" = true`,
    prisma.$executeRaw`INSERT INTO "PessoalAgendaToken" ("id","userId","token","ativo","createdAt") VALUES (${gid()}, ${g.userId}, ${token}, true, NOW())`,
  ])
  return NextResponse.json({ ok: true, token })
}

export async function DELETE() {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  await prisma.$executeRaw`UPDATE "PessoalAgendaToken" SET "ativo" = false, "revogadoEm" = NOW() WHERE "userId" = ${g.userId} AND "ativo" = true`
  return NextResponse.json({ ok: true })
}
