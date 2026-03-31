import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

// GET — histórico de movimentações
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ materialId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { materialId } = await params
  const workspaceId = session.user.workspaceId

  const rows = await prisma.$queryRaw`
    SELECT "id","tipo","quantidade","saldoApos",
           "motivo","referencia","fornecedor","usuarioNome","createdAt"
    FROM "EstMaterialMovimento"
    WHERE "workspaceId" = ${workspaceId} AND "materialId" = ${materialId}
    ORDER BY "createdAt" DESC
    LIMIT 200
  ` as any[]

  return NextResponse.json(serialize(rows))
}

// PUT — atualiza estoque mínimo
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ materialId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { materialId } = await params
  const workspaceId = session.user.workspaceId
  const { estoqueMinimo } = await req.json()

  await prisma.$executeRaw`
    UPDATE "EstMaterialSaldo"
    SET "estoqueMinimo" = ${parseFloat(estoqueMinimo) || 0}, "updatedAt" = NOW()
    WHERE "workspaceId" = ${workspaceId} AND "materialId" = ${materialId}
  `
  return NextResponse.json({ ok: true })
}

// DELETE — remove material do estoque (mantém histórico)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ materialId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { materialId } = await params
  const workspaceId = session.user.workspaceId

  await prisma.$executeRaw`
    DELETE FROM "EstMaterialSaldo"
    WHERE "workspaceId" = ${workspaceId} AND "materialId" = ${materialId}
  `
  return NextResponse.json({ ok: true })
}
