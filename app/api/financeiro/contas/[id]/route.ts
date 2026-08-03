// Contas bancárias — PUT (editar), DELETE (remover; lançamentos vinculados ficam sem conta).
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureContasBancarias } from '@/lib/finConta'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId
  await ensureContasBancarias()
  const { id } = await params
  const b = await req.json().catch(() => ({}))

  const [ex] = await prisma.$queryRaw`SELECT "id" FROM "FinConta" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId} LIMIT 1` as { id: string }[]
  if (!ex) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })

  if (b.nome         !== undefined) await prisma.$executeRaw`UPDATE "FinConta" SET "nome" = ${String(b.nome).trim()} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  if (b.tipo         !== undefined && String(b.tipo).trim())
                                     await prisma.$executeRaw`UPDATE "FinConta" SET "tipo" = ${String(b.tipo).trim().slice(0, 40)} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  if (b.banco        !== undefined) await prisma.$executeRaw`UPDATE "FinConta" SET "banco" = ${b.banco || null} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  if (b.saldoInicial !== undefined) await prisma.$executeRaw`UPDATE "FinConta" SET "saldoInicial" = ${Number(b.saldoInicial) || 0} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  if (b.rendimento   !== undefined) await prisma.$executeRaw`UPDATE "FinConta" SET "rendimento" = ${b.rendimento != null && b.rendimento !== '' ? Number(b.rendimento) : null} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  if (b.ativo        !== undefined) await prisma.$executeRaw`UPDATE "FinConta" SET "ativo" = ${!!b.ativo} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId
  await ensureContasBancarias()
  const { id } = await params
  // Desvincula os lançamentos (ficam sem conta) e remove transferências que a envolvem.
  await prisma.$executeRaw`UPDATE "FinLancamento" SET "contaId" = NULL WHERE "contaId" = ${id} AND "workspaceId" = ${workspaceId}`
  await prisma.$executeRaw`DELETE FROM "FinTransferencia" WHERE "workspaceId" = ${workspaceId} AND ("contaOrigemId" = ${id} OR "contaDestinoId" = ${id})`
  await prisma.$executeRaw`DELETE FROM "FinConta" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  return NextResponse.json({ ok: true })
}
