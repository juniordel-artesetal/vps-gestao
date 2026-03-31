import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { id } = await params
  const workspaceId = session.user.workspaceId
  const body = await req.json()

  const check = await prisma.$queryRaw`
    SELECT "id" FROM "Demanda" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId} LIMIT 1
  ` as any[]
  if (check.length === 0) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  // Atualiza campos enviados
  if (body.status !== undefined) {
    const dataPag = body.status === 'PAGO' ? new Date() : null
    await prisma.$executeRaw`
      UPDATE "Demanda"
      SET "status" = ${body.status},
          "dataPagamento" = ${dataPag},
          "updatedAt" = NOW()
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `
  }
  if (body.qtdProduzida !== undefined) {
    const qtd = parseInt(body.qtdProduzida)
    const total = body.valorTotal !== undefined ? parseFloat(body.valorTotal) : 0
    await prisma.$executeRaw`
      UPDATE "Demanda"
      SET "qtdProduzida" = ${qtd},
          "valorTotal"   = ${total},
          "status"       = ${body.status || 'PRODUZIDO'},
          "updatedAt"    = NOW()
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `
  }
  if (body.freelancerId !== undefined || body.nomeProduto !== undefined) {
    const { freelancerId, variacaoId, nomeProduto, qtdSolicitada, valorPorItem, pedidoId, observacoes } = body
    if (freelancerId) await prisma.$executeRaw`UPDATE "Demanda" SET "freelancerId" = ${freelancerId}, "updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (variacaoId !== undefined) await prisma.$executeRaw`UPDATE "Demanda" SET "variacaoId" = ${variacaoId || null}, "updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (nomeProduto) await prisma.$executeRaw`UPDATE "Demanda" SET "nomeProduto" = ${nomeProduto}, "updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (qtdSolicitada !== undefined) await prisma.$executeRaw`UPDATE "Demanda" SET "qtdSolicitada" = ${parseInt(qtdSolicitada)}, "updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (valorPorItem !== undefined) await prisma.$executeRaw`UPDATE "Demanda" SET "valorPorItem" = ${parseFloat(valorPorItem) || 0}, "updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (pedidoId !== undefined) await prisma.$executeRaw`UPDATE "Demanda" SET "pedidoId" = ${pedidoId || null}, "updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (observacoes !== undefined) await prisma.$executeRaw`UPDATE "Demanda" SET "observacoes" = ${observacoes || null}, "updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { id } = await params
  const workspaceId = session.user.workspaceId
  await prisma.$executeRaw`DELETE FROM "Demanda" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  return NextResponse.json({ ok: true })
}
