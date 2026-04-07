// app/api/suporte/feedback/route.ts
// Feedbacks enviados pela usuária logada (ela vê seus próprios feedbacks)
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (typeof obj === 'object' && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') {
    const r: any = {}
    for (const k of Object.keys(obj)) r[k] = serialize(obj[k])
    return r
  }
  return obj
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const workspaceId = session.user.workspaceId

  try {
    const feedbacks = await prisma.$queryRaw`
      SELECT
        id, tipo, titulo, descricao,
        status, "notaInterna", "createdAt"
      FROM "SuporteFeedback"
      WHERE "workspaceId" = ${workspaceId}
      ORDER BY "createdAt" DESC
      LIMIT 50
    ` as any[]

    return NextResponse.json(serialize(feedbacks))
  } catch (err) {
    console.error('[GET /api/suporte/feedback]', err)
    return NextResponse.json([])
  }
}
