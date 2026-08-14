// Um lançamento pessoal: GET / PUT (editar, incl. marcar PAGO) / DELETE (com recorrência). Escopo por userId.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize, parseNum, parseData } from '@/lib/pessoal/api'
import { normalizarImagemEntrada } from '@/lib/pessoal/imagem'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const [row] = await prisma.$queryRaw`
    SELECT "id","tipo","categoriaId","contaId","descricao","valor"::float AS valor,"data","metodo","referencia",
           "observacoes","status","recorrenciaId","recorrencia","parcela","totalParcelas",
           ("comprovante" IS NOT NULL) AS "temComprovante"
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
  if (b?.descricao === undefined && b?.valor === undefined && b?.status !== undefined && b?.comprovante === undefined) {
    const st = b.status === 'PENDENTE' ? 'PENDENTE' : 'PAGO'
    await prisma.$executeRaw`UPDATE "PessoalLancamento" SET "status" = ${st} WHERE "id" = ${id} AND "userId" = ${g.userId}`
    return NextResponse.json({ ok: true })
  }

  // Patch de comprovante isolado (anexar/remover sem reeditar o resto).
  if (b?.descricao === undefined && b?.valor === undefined && b?.comprovante !== undefined) {
    let comp: string | null
    try { comp = (normalizarImagemEntrada(b.comprovante) ?? null) as string | null }
    catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
    await prisma.$executeRaw`UPDATE "PessoalLancamento" SET "comprovante" = ${comp} WHERE "id" = ${id} AND "userId" = ${g.userId}`
    return NextResponse.json({ ok: true })
  }

  const descricao = String(b?.descricao ?? '').trim()
  const valor = parseNum(b?.valor)
  const data = parseData(b?.data)
  if (!descricao || valor <= 0 || !data) return NextResponse.json({ error: 'Informe descrição, valor e data.' }, { status: 400 })

  const METODOS = ['PIX', 'CARTAO', 'DINHEIRO', 'BOLETO', 'TED']
  const metodo = METODOS.includes(String(b?.metodo || '').toUpperCase()) ? String(b.metodo).toUpperCase() : null
  await prisma.$executeRaw`
    UPDATE "PessoalLancamento" SET
      "tipo" = ${b?.tipo === 'RECEITA' ? 'RECEITA' : 'DESPESA'},
      "categoriaId" = ${b?.categoriaId || null}, "contaId" = ${b?.contaId || null}, "metodo" = ${metodo},
      "descricao" = ${descricao}, "valor" = ${valor}, "data" = ${data}::date,
      "referencia" = ${b?.referencia || null}, "observacoes" = ${b?.observacoes || null},
      "status" = ${b?.status === 'PENDENTE' ? 'PENDENTE' : 'PAGO'}
    WHERE "id" = ${id} AND "userId" = ${g.userId}
  `
  if (b?.comprovante !== undefined) {
    let comp: string | null
    try { comp = (normalizarImagemEntrada(b.comprovante) ?? null) as string | null }
    catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
    await prisma.$executeRaw`UPDATE "PessoalLancamento" SET "comprovante" = ${comp} WHERE "id" = ${id} AND "userId" = ${g.userId}`
  }
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
