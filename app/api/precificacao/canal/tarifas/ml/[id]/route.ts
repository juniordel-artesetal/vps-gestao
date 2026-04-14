import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return parseFloat(String(obj))
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

// ── PUT — atualiza uma tarifa específica
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId
  const { id } = await params

  const body = await req.json()
  const taxaFixa = parseFloat(String(body.taxaFixa || 0))

  // Verifica que a tarifa pertence ao workspace
  const rows = await prisma.$queryRaw`
    SELECT id FROM "CanalTarifaML"
    WHERE id = ${id} AND "workspaceId" = ${workspaceId}
  ` as any[]

  if (rows.length === 0)
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  await prisma.$executeRaw`
    UPDATE "CanalTarifaML"
    SET "taxaFixa" = ${taxaFixa}
    WHERE id = ${id} AND "workspaceId" = ${workspaceId}
  `

  return NextResponse.json({ ok: true })
}

// ── DELETE — remove uma tarifa específica
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId
  const { id } = await params

  await prisma.$executeRaw`
    DELETE FROM "CanalTarifaML"
    WHERE id = ${id} AND "workspaceId" = ${workspaceId}
  `

  return NextResponse.json({ ok: true })
}
