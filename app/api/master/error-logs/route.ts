// app/api/master/error-logs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
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

async function verificarMaster(req: NextRequest): Promise<boolean> {
  // Aceita via header (subpáginas) ou cookie (master principal)
  const headerToken = req.headers.get('x-master-token')
  if (headerToken) return headerToken === process.env.MASTER_SECRET_TOKEN
  const cookieStore = await cookies()
  return cookieStore.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// GET — lista logs com filtros
export async function GET(req: NextRequest) {
  if (!await verificarMaster(req))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspaceId') || null
  const rota        = searchParams.get('rota') || null
  const pagina      = parseInt(searchParams.get('pagina') || '1')
  const limite      = 50
  const offset      = (pagina - 1) * limite

  const logs = await prisma.$queryRaw`
    SELECT
      el.id, el."workspaceId", el."userId", el.rota, el.metodo,
      el.erro, el.payload, el."createdAt",
      w.nome AS "workspaceNome"
    FROM "ErrorLog" el
    LEFT JOIN "Workspace" w ON w.id = el."workspaceId"
    WHERE (${workspaceId}::text IS NULL OR el."workspaceId" = ${workspaceId})
      AND (${rota}::text IS NULL OR el.rota ILIKE ${'%' + (rota || '') + '%'})
    ORDER BY el."createdAt" DESC
    LIMIT ${limite} OFFSET ${offset}
  ` as any[]

  const [total] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS total FROM "ErrorLog" el
    WHERE (${workspaceId}::text IS NULL OR el."workspaceId" = ${workspaceId})
      AND (${rota}::text IS NULL OR el.rota ILIKE ${'%' + (rota || '') + '%'})
  ` as any[]

  return NextResponse.json(serialize({ logs, total: total.total, pagina, limite }))
}

// DELETE — limpar logs antigos (mais de 30 dias)
export async function DELETE(req: NextRequest) {
  if (!await verificarMaster(req))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const [result] = await prisma.$queryRaw`
    WITH deleted AS (
      DELETE FROM "ErrorLog"
      WHERE "createdAt" < NOW() - INTERVAL '30 days'
      RETURNING id
    ) SELECT COUNT(*)::int AS total FROM deleted
  ` as any[]

  return NextResponse.json({ ok: true, removidos: result.total })
}
