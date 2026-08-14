// Um lançamento pessoal: GET / PUT (editar, incl. marcar PAGO) / DELETE (com recorrência). Escopo por userId.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize, parseNum, parseData } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const [row] = await prisma.$queryRaw`
    SELECT "id","tipo","categoriaId","descricao","valor"::float AS valor,"data","canal","referencia",
           "observacoes","status","recorrenciaId","recorrencia","parcela","totalParcelas"
    FROM "PessoalLancamento" WHERE "id" = ${id} AND "userId" = ${g.userId} LIMIT 1
  ` as any[]
  if (!row) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json(serialize(row))
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const b = await req.json().catch(() => ({}))

  // Patch leve: só alternar status (marcar pago/pendente).
  if (b?.descricao === undefined && b?.valor === undefined && b?.status !== undefined) {
    const st = b.status === 'PENDENTE' ? 'PENDENTE' : 'PAGO'
    await prisma.$executeRaw`UPDATE "PessoalLancamento" SET "status" = ${st} WHERE "id" = ${id} AND "userId" = ${g.userId}`
    return NextResponse.json({ ok: true })
  }

  const descricao = String(b?.descricao ?? '').trim()
  const valor = parseNum(b?.valor)
  const data = parseData(b?.data)
  if (!descricao || valor <= 0 || !data) return NextResponse.json({ error: 'Informe descrição, valor e data.' }, { status: 400 })

  await prisma.$executeRaw`
    UPDATE "PessoalLancamento" SET
      "tipo" = ${b?.tipo === 'RECEITA' ? 'RECEITA' : 'DESPESA'},
      "categoriaId" = ${b?.categoriaId || null},
      "descricao" = ${descricao}, "valor" = ${valor}, "data" = ${data}::date,
      "canal" = ${b?.canal || null}, "referencia" = ${b?.referencia || null}, "observacoes" = ${b?.observacoes || null},
      "status" = ${b?.status === 'PENDENTE' ? 'PENDENTE' : 'PAGO'}
    WHERE "id" = ${id} AND "userId" = ${g.userId}
  `
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const sp = new URL(req.url).searchParams
  const futuros = sp.get('deletarFuturos') === 'true'
  const todos = sp.get('deletarTodos') === 'true'

  if (futuros || todos) {
    const [l] = await prisma.$queryRaw`SELECT "recorrenciaId","data" FROM "PessoalLancamento" WHERE "id" = ${id} AND "userId" = ${g.userId} LIMIT 1` as any[]
    if (l?.recorrenciaId) {
      if (todos) await prisma.$executeRaw`DELETE FROM "PessoalLancamento" WHERE "userId" = ${g.userId} AND "recorrenciaId" = ${l.recorrenciaId}`
      else await prisma.$executeRaw`DELETE FROM "PessoalLancamento" WHERE "userId" = ${g.userId} AND "recorrenciaId" = ${l.recorrenciaId} AND "data" >= ${l.data} AND ("status" = 'PENDENTE' OR "id" = ${id})`
      return NextResponse.json({ ok: true })
    }
  }
  await prisma.$executeRaw`DELETE FROM "PessoalLancamento" WHERE "id" = ${id} AND "userId" = ${g.userId}`
  return NextResponse.json({ ok: true })
}
