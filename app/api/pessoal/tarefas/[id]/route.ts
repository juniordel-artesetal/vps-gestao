// Editar/alternar status/excluir tarefa pessoal. Escopo por userId.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, parseData } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'
const STATUS = ['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA']
const PRIOS = ['BAIXA', 'MEDIA', 'ALTA']

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const b = await req.json().catch(() => ({}))

  // Toggle rápido de status (concluidaEm setada/limpa conforme CONCLUIDA).
  if (b?.status !== undefined && b?.titulo === undefined) {
    const st = STATUS.includes(b.status) ? b.status : 'PENDENTE'
    await prisma.$executeRaw`
      UPDATE "PessoalTarefa" SET "status" = ${st},
        "concluidaEm" = ${st === 'CONCLUIDA' ? new Date() : null}
      WHERE "id" = ${id} AND "userId" = ${g.userId}
    `
    return NextResponse.json({ ok: true })
  }

  const titulo = String(b?.titulo ?? '').trim()
  if (!titulo) return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 })
  const st = STATUS.includes(b?.status) ? b.status : 'PENDENTE'
  await prisma.$executeRaw`
    UPDATE "PessoalTarefa" SET
      "titulo" = ${titulo}, "descricao" = ${b?.descricao || null},
      "prazo" = ${parseData(b?.prazo)}::date,
      "prioridade" = ${PRIOS.includes(b?.prioridade) ? b.prioridade : 'MEDIA'},
      "status" = ${st}, "concluidaEm" = ${st === 'CONCLUIDA' ? new Date() : null}
    WHERE "id" = ${id} AND "userId" = ${g.userId}
  `
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  await prisma.$executeRaw`DELETE FROM "PessoalTarefa" WHERE "id" = ${id} AND "userId" = ${g.userId}`
  return NextResponse.json({ ok: true })
}
