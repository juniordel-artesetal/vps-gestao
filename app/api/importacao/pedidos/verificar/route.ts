// app/api/importacao/pedidos/verificar/route.ts
// Verifica quais números de pedido já existem no workspace
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId

  try {
    const { numeros } = await req.json()
    if (!Array.isArray(numeros) || numeros.length === 0)
      return NextResponse.json({ jaExistentes: [] })

    // Filtra só os não vazios e únicos
    const numerosLimpos = Array.from(new Set(
      numeros.map(n => String(n || '').trim()).filter(n => n.length > 0)
    ))

    if (numerosLimpos.length === 0)
      return NextResponse.json({ jaExistentes: [] })

    const rows = await prisma.$queryRaw`
      SELECT "numero"
      FROM "Order"
      WHERE "workspaceId" = ${workspaceId}
        AND "numero" = ANY(${numerosLimpos}::text[])
    ` as { numero: string }[]

    return NextResponse.json({ jaExistentes: rows.map(r => r.numero) })
  } catch (err) {
    console.error('[POST /api/importacao/pedidos/verificar]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
