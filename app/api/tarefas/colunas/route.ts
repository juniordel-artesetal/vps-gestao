import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
function novoId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// POST — cria coluna num quadro
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { quadroId, nome, cor } = await req.json()
  if (!quadroId || !nome?.trim()) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  // Confirma quadro do workspace
  const q = await prisma.$queryRaw`SELECT "id" FROM "TarefaQuadro" WHERE "id"=${quadroId} AND "workspaceId"=${workspaceId} LIMIT 1` as any[]
  if (!q.length) return NextResponse.json({ error: 'Quadro não encontrado' }, { status: 404 })

  const [{ maxOrdem }] = await prisma.$queryRaw`
    SELECT COALESCE(MAX("ordem"), -1)::int AS "maxOrdem" FROM "TarefaColuna" WHERE "quadroId"=${quadroId} AND "workspaceId"=${workspaceId}
  ` as any[]

  const id = novoId()
  await prisma.$executeRaw`
    INSERT INTO "TarefaColuna" ("id","quadroId","workspaceId","nome","cor","ordem")
    VALUES (${id}, ${quadroId}, ${workspaceId}, ${nome.trim()}, ${cor || null}, ${Number(maxOrdem) + 1})
  `
  return NextResponse.json({ ok: true, id })
}
