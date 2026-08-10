import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

async function verificarMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// GET — lista pacotes de venda (definição). Filtro opcional ?tipo=
export async function GET(req: NextRequest) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get('tipo')
  const rows = tipo
    ? await prisma.$queryRaw`
        SELECT "id","tipo","nome","quantidade"::int AS "quantidade","preco"::float AS "preco","ativo"
        FROM "CreditoPacote" WHERE "tipo" = ${tipo} ORDER BY "ativo" DESC, "quantidade" ASC
      ` as any[]
    : await prisma.$queryRaw`
        SELECT "id","tipo","nome","quantidade"::int AS "quantidade","preco"::float AS "preco","ativo"
        FROM "CreditoPacote" ORDER BY "tipo" ASC, "ativo" DESC, "quantidade" ASC
      ` as any[]
  return NextResponse.json(serialize(rows))
}

// POST — cria/edita pacote. body: { id?, tipo, nome, quantidade, preco, ativo? }
export async function POST(req: NextRequest) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const tipo = String(b.tipo || '').trim()
  const nome = String(b.nome || '').trim()
  const quantidade = parseInt(String(b.quantidade)) || 0
  const preco = b.preco !== null && b.preco !== undefined && b.preco !== '' ? parseFloat(String(b.preco)) : 0
  const ativo = b.ativo !== false

  if (!tipo || !nome) return NextResponse.json({ error: 'Tipo e nome obrigatórios' }, { status: 400 })
  if (quantidade <= 0) return NextResponse.json({ error: 'Quantidade inválida' }, { status: 400 })

  if (b.id) {
    await prisma.$executeRaw`
      UPDATE "CreditoPacote"
      SET "tipo" = ${tipo}, "nome" = ${nome}, "quantidade" = ${quantidade}, "preco" = ${preco}, "ativo" = ${ativo}
      WHERE "id" = ${String(b.id)}
    `
    return NextResponse.json({ ok: true, id: b.id })
  }

  const id = gerarId()
  await prisma.$executeRaw`
    INSERT INTO "CreditoPacote" ("id","tipo","nome","quantidade","preco","ativo")
    VALUES (${id}, ${tipo}, ${nome}, ${quantidade}, ${preco}, ${ativo})
  `
  return NextResponse.json({ ok: true, id })
}

// DELETE — remove pacote. ?id=
export async function DELETE(req: NextRequest) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await prisma.$executeRaw`DELETE FROM "CreditoPacote" WHERE "id" = ${id}`
  return NextResponse.json({ ok: true })
}
