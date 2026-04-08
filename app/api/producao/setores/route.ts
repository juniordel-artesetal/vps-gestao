import { NextRequest, NextResponse } from 'next/server'
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

// GET — todos os roles podem ler os setores (precisam para navegar)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const workspaceId = session.user.workspaceId

    const setores = await prisma.$queryRaw`
      SELECT "id", "nome", "icone", "cor", "ordem", "ativo"
      FROM "SetorConfig"
      WHERE "workspaceId" = ${workspaceId}
        AND "ativo" = true
      ORDER BY "ordem" ASC, "nome" ASC
    ` as any[]

    return NextResponse.json(serialize(setores))
  } catch (err) {
    console.error('[GET /api/producao/setores]', err)
    return NextResponse.json({ error: 'Erro ao buscar setores' }, { status: 500 })
  }
}

// POST — apenas ADMIN pode criar setor
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const workspaceId = session.user.workspaceId
    const body = await req.json()
    const { nome, icone, cor, ordem } = body

    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

    const id = Math.random().toString(36).slice(2) + Date.now().toString(36)

    await prisma.$executeRaw`
      INSERT INTO "SetorConfig" ("id", "workspaceId", "nome", "icone", "cor", "ordem", "ativo")
      VALUES (${id}, ${workspaceId}, ${nome}, ${icone ?? null}, ${cor ?? null}, ${ordem ?? 0}, true)
    `

    return NextResponse.json({ ok: true, id })
  } catch (err) {
    console.error('[POST /api/producao/setores]', err)
    return NextResponse.json({ error: 'Erro ao criar setor' }, { status: 500 })
  }
}
