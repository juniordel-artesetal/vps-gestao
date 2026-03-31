import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { searchParams } = new URL(req.url)
  const todos = searchParams.get('todos') === '1'

  // Busca todos e filtra no JS para evitar condicional inválida em $queryRaw
  const all = await prisma.$queryRaw`
    SELECT
      "id", "nome", "telefone", "pix",
      "especialidade", "observacoes", "ativo", "createdAt"
    FROM "Freelancer"
    WHERE "workspaceId" = ${workspaceId}
    ORDER BY "nome" ASC
  ` as any[]

  const result = todos ? all : all.filter((f: any) => f.ativo === true)

  return NextResponse.json(serialize(result))
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { nome, telefone, pix, especialidade, observacoes } = await req.json()

  if (!nome?.trim())
    return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

  const id = Math.random().toString(36).slice(2) + Date.now().toString(36)

  await prisma.$executeRaw`
    INSERT INTO "Freelancer"
      ("id", "workspaceId", "nome", "telefone", "pix", "especialidade", "observacoes", "ativo")
    VALUES
      (${id}, ${workspaceId}, ${nome.trim()},
       ${telefone || null}, ${pix || null},
       ${especialidade || null}, ${observacoes || null}, true)
  `

  return NextResponse.json({ ok: true, id })
}
