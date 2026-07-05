import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normNome } from '@/lib/normNome'

export const dynamic = 'force-dynamic'
function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}
function novoId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }
const CONDICOES = ['queda', 'abaixo_de']

// GET — alertas do workspace
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const rows = await prisma.$queryRaw`
    SELECT "id","termo","normNome","condicao","valorAlvo"::float AS "valorAlvo","ativo","createdAt"
    FROM "PesquisaAlerta" WHERE "workspaceId"=${session.user.workspaceId} ORDER BY "createdAt" DESC
  ` as any[]
  return NextResponse.json(serialize(rows))
}

// POST — segue um material (cria/atualiza alerta). body: { termo, condicao, valorAlvo }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const ws = session.user.workspaceId
  const b = await req.json()
  const termo = String(b.termo || '').trim()
  const qn = normNome(termo)
  if (!qn || qn.length < 2) return NextResponse.json({ error: 'Material inválido' }, { status: 400 })
  const condicao = CONDICOES.includes(b.condicao) ? b.condicao : 'queda'
  const valorAlvo = b.valorAlvo != null && Number(b.valorAlvo) > 0 ? Number(b.valorAlvo) : null

  const [existe] = await prisma.$queryRaw`SELECT "id" FROM "PesquisaAlerta" WHERE "workspaceId"=${ws} AND "normNome"=${qn} LIMIT 1` as any[]
  if (existe) {
    await prisma.$executeRaw`UPDATE "PesquisaAlerta" SET "condicao"=${condicao}, "valorAlvo"=${valorAlvo}, "ativo"=true, "termo"=${termo} WHERE "id"=${existe.id} AND "workspaceId"=${ws}`
    return NextResponse.json({ ok: true, id: existe.id })
  }
  const id = novoId()
  await prisma.$executeRaw`
    INSERT INTO "PesquisaAlerta" ("id","workspaceId","userId","normNome","termo","condicao","valorAlvo","ativo","createdAt")
    VALUES (${id}, ${ws}, ${session.user.id || null}, ${qn}, ${termo}, ${condicao}, ${valorAlvo}, true, NOW())
  `
  return NextResponse.json({ ok: true, id })
}

// DELETE ?id= — deixa de seguir
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await prisma.$executeRaw`DELETE FROM "PesquisaAlerta" WHERE "id"=${id} AND "workspaceId"=${session.user.workspaceId}`
  return NextResponse.json({ ok: true })
}
