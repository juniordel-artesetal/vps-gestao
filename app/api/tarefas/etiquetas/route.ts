import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}
function novoId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// GET — etiquetas do workspace
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const rows = await prisma.$queryRaw`
    SELECT "id","nome","cor" FROM "TarefaEtiqueta" WHERE "workspaceId"=${session.user.workspaceId} ORDER BY "createdAt" ASC
  ` as any[]
  return NextResponse.json(serialize(rows))
}

// POST — cria etiqueta
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { nome, cor } = await req.json()
  if (!nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  const id = novoId()
  await prisma.$executeRaw`
    INSERT INTO "TarefaEtiqueta" ("id","workspaceId","nome","cor","createdAt")
    VALUES (${id}, ${session.user.workspaceId}, ${nome.trim()}, ${cor || '#f97316'}, NOW())
  `
  return NextResponse.json({ ok: true, id })
}
