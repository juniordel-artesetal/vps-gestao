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

// GET — lista todos os campos do workspace
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId

  const rows = await prisma.$queryRaw`
    SELECT
      "id", "nome", "tipo", "opcoes",
      "obrigatorio", "ordem", "ativo", "createdAt"
    FROM "EstCampoConfig"
    WHERE "workspaceId" = ${workspaceId}
    ORDER BY "ordem" ASC, "createdAt" ASC
  ` as any[]

  return NextResponse.json(serialize(rows))
}

// POST — cria novo campo
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { nome, tipo, opcoes, obrigatorio } = await req.json()

  if (!nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  if (!['TEXT', 'NUMBER', 'SELECT', 'DATE', 'BOOLEAN'].includes(tipo))
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

  // Próxima ordem
  const ordemRows = await prisma.$queryRaw`
    SELECT COALESCE(MAX("ordem"), -1)::int AS "maxOrdem"
    FROM "EstCampoConfig"
    WHERE "workspaceId" = ${workspaceId}
  ` as any[]
  const proxOrdem = Number(ordemRows[0]?.maxOrdem ?? -1) + 1

  const id = Math.random().toString(36).slice(2) + Date.now().toString(36)

  await prisma.$executeRaw`
    INSERT INTO "EstCampoConfig"
      ("id", "workspaceId", "nome", "tipo", "opcoes", "obrigatorio", "ordem", "ativo")
    VALUES
      (${id}, ${workspaceId}, ${nome.trim()}, ${tipo},
       ${opcoes ?? null}, ${Boolean(obrigatorio)}, ${proxOrdem}, true)
  `

  return NextResponse.json({ ok: true, id })
}
