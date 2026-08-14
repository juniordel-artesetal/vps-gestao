// Categorias pessoais (RECEITA/DESPESA) com cor/ícone. Escopo por userId.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize, gid } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const cats = await prisma.$queryRaw`
    SELECT "id","nome","tipo","cor","icone" FROM "PessoalCategoria"
    WHERE "userId" = ${g.userId} ORDER BY "tipo" ASC, "nome" ASC
  `
  return NextResponse.json(serialize(cats))
}

export async function POST(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const b = await req.json().catch(() => ({}))
  const nome = String(b?.nome ?? '').trim()
  if (!nome) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  const tipo = b?.tipo === 'RECEITA' ? 'RECEITA' : 'DESPESA'
  const id = gid()
  await prisma.$executeRaw`
    INSERT INTO "PessoalCategoria" ("id","userId","nome","tipo","cor","icone","createdAt")
    VALUES (${id}, ${g.userId}, ${nome}, ${tipo}, ${b?.cor || null}, ${b?.icone || null}, NOW())
  `
  return NextResponse.json({ ok: true, id }, { status: 201 })
}
