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
  if (typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}
function novoId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

const COLUNAS_PADRAO = [
  { nome: 'A Fazer', cor: '#94a3b8' },
  { nome: 'Em andamento', cor: '#3b82f6' },
  { nome: 'Revisão', cor: '#f59e0b' },
  { nome: 'Concluídas', cor: '#22c55e' },
]

// GET — quadros do workspace com contagem de tarefas
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const rows = await prisma.$queryRaw`
    SELECT q."id", q."nome", q."cor", q."ordem", q."ativo", q."createdAt",
           (SELECT COUNT(*)::int FROM "Tarefa" t WHERE t."quadroId" = q."id") AS "nTarefas"
    FROM "TarefaQuadro" q
    WHERE q."workspaceId" = ${session.user.workspaceId} AND q."ativo" = true
    ORDER BY q."ordem" ASC, q."createdAt" ASC
  ` as any[]
  return NextResponse.json(serialize(rows))
}

// POST — cria quadro + semeia colunas padrão
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { nome, cor } = await req.json()
  if (!nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

  const [{ maxOrdem }] = await prisma.$queryRaw`
    SELECT COALESCE(MAX("ordem"), -1)::int AS "maxOrdem" FROM "TarefaQuadro" WHERE "workspaceId" = ${workspaceId}
  ` as any[]

  const quadroId = novoId()
  await prisma.$executeRaw`
    INSERT INTO "TarefaQuadro" ("id","workspaceId","nome","cor","ordem","ativo","createdAt")
    VALUES (${quadroId}, ${workspaceId}, ${nome.trim()}, ${cor || null}, ${Number(maxOrdem) + 1}, true, NOW())
  `
  // Semeia colunas padrão
  for (let i = 0; i < COLUNAS_PADRAO.length; i++) {
    const c = COLUNAS_PADRAO[i]
    await prisma.$executeRaw`
      INSERT INTO "TarefaColuna" ("id","quadroId","workspaceId","nome","cor","ordem")
      VALUES (${novoId()}, ${quadroId}, ${workspaceId}, ${c.nome}, ${c.cor}, ${i})
    `
  }
  return NextResponse.json({ ok: true, id: quadroId })
}
