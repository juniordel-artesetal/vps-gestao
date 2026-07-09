import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDemandaTables } from '../../_lib/schema'

// PUT — edita um preço por peça (produto / valor / freelancer / ativo)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    await ensureDemandaTables()

    const { id } = await params
    const workspaceId = session.user.workspaceId
    const { produto, valorUnitario, freelancerId, ativo } = await req.json()

    const check = await prisma.$queryRaw`
      SELECT "id" FROM "DemandaPreco" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId} LIMIT 1
    ` as any[]
    if (check.length === 0) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    if (produto       !== undefined) await prisma.$executeRaw`UPDATE "DemandaPreco" SET "produto"       = ${String(produto).trim()},                 "updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (valorUnitario !== undefined) await prisma.$executeRaw`UPDATE "DemandaPreco" SET "valorUnitario" = ${parseFloat(String(valorUnitario)) || 0}, "updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (freelancerId  !== undefined) await prisma.$executeRaw`UPDATE "DemandaPreco" SET "freelancerId"  = ${freelancerId || null},                  "updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (ativo         !== undefined) await prisma.$executeRaw`UPDATE "DemandaPreco" SET "ativo"         = ${Boolean(ativo)},                        "updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[PUT demandas/precos/id]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// DELETE — remove um preço por peça
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    await ensureDemandaTables()

    const { id } = await params
    const workspaceId = session.user.workspaceId
    await prisma.$executeRaw`DELETE FROM "DemandaPreco" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE demandas/precos/id]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
