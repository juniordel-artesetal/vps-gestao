// app/api/financeiro/lancamentos/[id]/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { id } = await params
  const {
    tipo, categoriaId, descricao, valor, data, status,
    dataRealizada, valorRealizado, canal, referencia, observacoes,
    alterarFuturos = false, // true = altera este e todos os próximos da recorrência
  } = await req.json()

  const catId    = categoriaId   || null
  const canalVal = canal         || null
  const refVal   = referencia    || null
  const obsVal   = observacoes   || null
  const drVal    = dataRealizada || null
  const vrVal    = valorRealizado ? Number(valorRealizado) : null

  // Buscar lançamento atual para pegar recorrenciaId e parcela
  const [atual] = await prisma.$queryRaw`
    SELECT "recorrenciaId", parcela FROM "FinLancamento"
    WHERE id = ${id} AND "workspaceId" = workspaceId
  ` as any[]

  // Atualizar o lançamento atual
  await prisma.$executeRawUnsafe(
    `UPDATE "FinLancamento" SET
      tipo=$1, "categoriaId"=$2, descricao=$3,
      valor=$4, data=$5::date, status=$6,
      "dataRealizada"=$7::date, "valorRealizado"=$8,
      canal=$9, referencia=$10, observacoes=$11
    WHERE id=$12 AND "workspaceId"=workspaceId`,
    tipo, catId, descricao,
    Number(valor), data, status,
    drVal, vrVal, canalVal, refVal, obsVal, id
  )

  // Se alterarFuturos e tem recorrência, atualiza os próximos (exceto o atual)
  if (alterarFuturos && atual?.recorrenciaId && atual?.parcela) {
    await prisma.$executeRawUnsafe(
      `UPDATE "FinLancamento" SET
        "categoriaId"=$1, valor=$2, canal=$3, referencia=$4, observacoes=$5
      WHERE "recorrenciaId"=$6
        AND parcela > $7
        AND status = 'PENDENTE'
        AND "workspaceId" = workspaceId`,
      catId, Number(valor), canalVal, refVal, obsVal,
      atual.recorrenciaId, atual.parcela
    )
  }

  const [row] = await prisma.$queryRaw`
    SELECT l.*, l.valor::float, l."valorRealizado"::float,
           c.nome AS "categoriaNome", c.cor AS "categoriaCor", c.icone AS "categoriaIcone"
    FROM "FinLancamento" l LEFT JOIN "FinCategoria" c ON c.id=l."categoriaId"
    WHERE l.id=${id}
  ` as any[]

  return NextResponse.json(row)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const deletarFuturos = searchParams.get('deletarFuturos') === 'true'

  // Buscar lançamento para pegar recorrenciaId e parcela
  const [atual] = await prisma.$queryRaw`
    SELECT "recorrenciaId", parcela FROM "FinLancamento"
    WHERE id = ${id} AND "workspaceId" = workspaceId
  ` as any[]

  if (deletarFuturos && atual?.recorrenciaId && atual?.parcela) {
    // Deleta este e todos os futuros PENDENTES da mesma recorrência
    await prisma.$executeRaw`
      DELETE FROM "FinLancamento"
      WHERE "recorrenciaId" = ${atual.recorrenciaId}
        AND parcela >= ${atual.parcela}
        AND status = 'PENDENTE'
        AND "workspaceId" = workspaceId
    `
  } else {
    await prisma.$executeRaw`
      DELETE FROM "FinLancamento"
      WHERE id = ${id} AND "workspaceId" = workspaceId
    `
  }

  return NextResponse.json({ ok: true })
}
