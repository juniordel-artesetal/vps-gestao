// app/api/precificacao/variacoes/[id]/historico/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { id } = await params
    const rows = await prisma.$queryRaw`
      SELECT * FROM "PrecVariacaoHistorico" WHERE "variacaoId"=${id} ORDER BY "createdAt" DESC LIMIT 100
    ` as any[]
    return NextResponse.json(rows)
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}
