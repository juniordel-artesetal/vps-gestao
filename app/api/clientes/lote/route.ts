// app/api/clientes/lote/route.ts — Ações em massa sobre clientes — VPS-20260630-NQA8
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { ids, acao } = await req.json()

  if (!Array.isArray(ids) || ids.length === 0)
    return NextResponse.json({ error: 'Nenhum cliente selecionado' }, { status: 400 })
  if (!['ativar', 'inativar', 'excluir'].includes(acao))
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })

  const idsValidos = ids.filter((x: any) => typeof x === 'string')

  // Isolamento total: só afeta clientes do próprio workspace
  if (acao === 'excluir') {
    await prisma.$executeRaw`UPDATE "Order" SET "clienteId" = NULL WHERE "workspaceId" = ${workspaceId} AND "clienteId" = ANY(${idsValidos}::text[])`
    await prisma.$executeRaw`DELETE FROM "ClienteContato"  WHERE "workspaceId" = ${workspaceId} AND "clienteId" = ANY(${idsValidos}::text[])`
    await prisma.$executeRaw`DELETE FROM "ClienteEndereco" WHERE "workspaceId" = ${workspaceId} AND "clienteId" = ANY(${idsValidos}::text[])`
    const res = await prisma.$executeRaw`DELETE FROM "Cliente" WHERE "workspaceId" = ${workspaceId} AND "id" = ANY(${idsValidos}::text[])`
    return NextResponse.json({ atualizados: Number(res), excluidos: Number(res) })
  }

  const ativo = acao === 'ativar'
  const res = await prisma.$executeRaw`
    UPDATE "Cliente"
    SET "ativo" = ${ativo}, "updatedAt" = NOW()
    WHERE "workspaceId" = ${workspaceId}
      AND "id" = ANY(${idsValidos}::text[])
  `

  return NextResponse.json({ atualizados: Number(res) })
}
