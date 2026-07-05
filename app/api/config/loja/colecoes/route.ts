import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}
function novoId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// GET — coleções do workspace
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const rows = await prisma.$queryRaw`
    SELECT "id","nome","ordem","ativo","createdAt"
    FROM "LojaColecao"
    WHERE "workspaceId" = ${session.user.workspaceId}
    ORDER BY "ordem" ASC, "createdAt" ASC
  ` as any[]
  return NextResponse.json(serialize(rows))
}

// POST — cria coleção
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { nome } = await req.json()
  if (!nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

  const [{ maxOrdem }] = await prisma.$queryRaw`
    SELECT COALESCE(MAX("ordem"), -1)::int AS "maxOrdem"
    FROM "LojaColecao" WHERE "workspaceId" = ${workspaceId}
  ` as any[]

  const id = novoId()
  await prisma.$executeRaw`
    INSERT INTO "LojaColecao" ("id","workspaceId","nome","ordem","ativo","createdAt")
    VALUES (${id}, ${workspaceId}, ${nome.trim()}, ${Number(maxOrdem) + 1}, true, NOW())
  `
  return NextResponse.json({ ok: true, id })
}
