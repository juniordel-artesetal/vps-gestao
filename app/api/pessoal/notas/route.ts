// Notas pessoais (estilo Keep): cores, pin, busca. Escopo por userId.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize, gid } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const rows = await prisma.$queryRaw`
    SELECT "id","titulo","conteudo","cor","fixada","createdAt","updatedAt"
    FROM "PessoalNota" WHERE "userId" = ${g.userId}
    ORDER BY "fixada" DESC, "updatedAt" DESC
  `
  return NextResponse.json(serialize(rows))
}

export async function POST(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const b = await req.json().catch(() => ({}))
  const titulo = (b?.titulo ? String(b.titulo).trim() : '') || null
  const conteudo = (b?.conteudo ? String(b.conteudo) : '') || null
  if (!titulo && !conteudo) return NextResponse.json({ error: 'Nota vazia' }, { status: 400 })
  const id = gid()
  await prisma.$executeRaw`
    INSERT INTO "PessoalNota" ("id","userId","titulo","conteudo","cor","fixada","createdAt","updatedAt")
    VALUES (${id}, ${g.userId}, ${titulo}, ${conteudo}, ${b?.cor || null}, ${!!b?.fixada}, NOW(), NOW())
  `
  return NextResponse.json({ ok: true, id }, { status: 201 })
}
