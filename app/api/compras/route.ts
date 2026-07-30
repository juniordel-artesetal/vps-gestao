// Pedido de compra — concluir gera contas a pagar + atualiza custo + entrada de estoque.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ensureComprasSchema, concluirPedidoCompra } from '@/lib/compras'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function moduloCompras(workspaceId: string): Promise<boolean> {
  await ensureComprasSchema()
  const r = await prisma.$queryRaw`SELECT "moduloCompras" AS m FROM "Workspace" WHERE "id" = ${workspaceId}` as { m: boolean }[]
  return !!r[0]?.m
}

// GET — estado do módulo (para a tela decidir mostrar o formulário ou o "ativar")
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  return NextResponse.json({ modulo: await moduloCompras(session.user.workspaceId) })
}

// POST — { acao:'ativar' } | pedido de compra
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId
  const body = await req.json().catch(() => ({}))

  if (body.acao === 'ativar') {
    await ensureComprasSchema()
    await prisma.$executeRaw`UPDATE "Workspace" SET "moduloCompras" = true WHERE "id" = ${workspaceId}`
    return NextResponse.json({ ok: true, modulo: true })
  }

  try {
    const resumo = await concluirPedidoCompra(workspaceId, { ...body, usuarioNome: session.user.name || null })
    return NextResponse.json(serialize({ ok: true, ...resumo }))
  } catch (e: any) {
    console.error('[COMPRAS] concluir:', e)
    return NextResponse.json({ error: e?.message || 'Erro ao concluir a compra.' }, { status: 400 })
  }
}
