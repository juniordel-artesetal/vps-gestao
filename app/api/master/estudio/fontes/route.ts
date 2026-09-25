// Master — curadoria do acervo de fontes do SOA Edition. Lista sugeridas/aprovadas e aprova ou
// retira. Aprovar = publicar para TODOS os workspaces: só com licença aberta conferida (regra de IP).
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ensureEstudioSchema } from '@/lib/estudio/schema'

export const dynamic = 'force-dynamic'

async function verificarMaster(req: NextRequest): Promise<boolean> {
  const headerToken = req.headers.get('x-master-token')
  if (headerToken) return headerToken === process.env.MASTER_SECRET_TOKEN
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

export async function GET(req: NextRequest) {
  if (!(await verificarMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  await ensureEstudioSchema()
  const fontes = await prisma.$queryRawUnsafe(
    `SELECT a."id", a."nome", a."url", a."meta"->>'licenca' AS licenca, a."meta"->>'familia' AS familia,
            a."sugeridaGlobal", a."aprovadaGlobal", a."createdAt", w."nome" AS "workspaceNome"
     FROM "EstudioAsset" a LEFT JOIN "Workspace" w ON w."id"=a."workspaceId"
     WHERE a."tipo"='fonte' AND (a."sugeridaGlobal" OR a."aprovadaGlobal")
     ORDER BY a."aprovadaGlobal", a."createdAt" DESC LIMIT 300`)
  return NextResponse.json(serialize({ fontes }))
}

// { id, aprovar: boolean } — aprovar publica no acervo; false retira (e limpa a sugestão).
export async function POST(req: NextRequest) {
  if (!(await verificarMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  await ensureEstudioSchema()
  const b = await req.json().catch(() => ({}))
  if (typeof b.id !== 'string') return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const aprovar = !!b.aprovar
  await prisma.$executeRawUnsafe(
    `UPDATE "EstudioAsset" SET "aprovadaGlobal"=$2, "sugeridaGlobal"=CASE WHEN $2 THEN "sugeridaGlobal" ELSE false END,
       "meta"="meta" || jsonb_build_object('curadoriaEm', now()::text, 'curadoria', CASE WHEN $2 THEN 'aprovada' ELSE 'recusada' END)
     WHERE "id"=$1 AND "tipo"='fonte'`, b.id, aprovar)
  return NextResponse.json({ ok: true })
}
