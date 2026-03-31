// Destino: app/api/fornecedores/[id]/compras/route.ts
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  try {
    const rows = await prisma.$queryRaw`
      SELECT * FROM "FornecedorCompra"
      WHERE "fornecedorId" = ${id}
      ORDER BY "data" DESC, "createdAt" DESC
    ` as any[]
    return NextResponse.json(serialize(rows))
  } catch (err) {
    console.error('[GET compras]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id: fornecedorId } = await params
  const workspaceId = session.user.workspaceId

  try {
    const body = await req.json()
    const { descricao, valor, data, nf, observacoes } = body

    if (!descricao || !valor || !data)
      return NextResponse.json(
        { error: 'Campos obrigatórios: descrição, valor e data' },
        { status: 400 }
      )

    const compraId = Math.random().toString(36).slice(2) + Date.now().toString(36)
    const dataDate = new Date(data)
    const valorNum = Number(valor)

    await prisma.$executeRaw`
      INSERT INTO "FornecedorCompra"
        ("id","fornecedorId","workspaceId","descricao","valor","data","nf","observacoes","createdAt")
      VALUES
        (${compraId}, ${fornecedorId}, ${workspaceId},
         ${descricao}, ${valorNum}, ${dataDate},
         ${nf || null}, ${observacoes || null}, NOW())
    `

    const rows = await prisma.$queryRaw`
      SELECT * FROM "FornecedorCompra" WHERE id = ${compraId}
    ` as any[]

    return NextResponse.json(serialize(rows[0]), { status: 201 })
  } catch (err) {
    console.error('[POST compras]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
