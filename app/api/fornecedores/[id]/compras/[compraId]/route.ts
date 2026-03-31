// Destino: app/api/fornecedores/[id]/compras/[compraId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; compraId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { compraId } = await params
  try {
    const body = await req.json()
    const { descricao, valor, data, nf, observacoes } = body
    const dataDate = new Date(data)
    const valorNum = Number(valor)

    await prisma.$executeRaw`
      UPDATE "FornecedorCompra" SET
        "descricao"   = ${descricao},
        "valor"       = ${valorNum},
        "data"        = ${dataDate},
        "nf"          = ${nf          || null},
        "observacoes" = ${observacoes || null}
      WHERE id = ${compraId}
    `

    const rows = await prisma.$queryRaw`
      SELECT * FROM "FornecedorCompra" WHERE id = ${compraId}
    ` as any[]

    return NextResponse.json(serialize(rows[0]))
  } catch (err) {
    console.error('[PUT compra]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; compraId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { compraId } = await params
  try {
    await prisma.$executeRaw`DELETE FROM "FornecedorCompra" WHERE id = ${compraId}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE compra]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
