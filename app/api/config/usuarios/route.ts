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

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const workspaceId = session.user.workspaceId

    const usuarios = await prisma.$queryRaw`
      SELECT id, nome, email, role, ativo
      FROM "User"
      WHERE "workspaceId" = ${workspaceId}
        AND ativo = true
      ORDER BY nome ASC
    ` as any[]

    return NextResponse.json(serialize({ usuarios }))
  } catch (error) {
    console.error('GET /api/config/usuarios:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
