// app/api/financeiro/metas/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { searchParams } = new URL(req.url)
  const ano = parseInt(searchParams.get('ano') || String(new Date().getFullYear()))

  const rows = await prisma.$queryRaw`
    SELECT id,ano,mes,"metaReceita"::float,"metaDespesa"::float,"metaLucro"::float
    FROM "FinMeta" WHERE "workspaceId"=${workspaceId} AND ano=${ano} ORDER BY mes
  `
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { ano, mes, metaReceita, metaDespesa, metaLucro } = await req.json()
  if (!ano || !mes) return NextResponse.json({ error: 'ano e mes são obrigatórios' }, { status: 400 })

  const id = Math.random().toString(36).slice(2) + Date.now().toString(36)

  await prisma.$executeRaw`
    INSERT INTO "FinMeta"("id","workspaceId","ano","mes","metaReceita","metaDespesa","metaLucro")
    VALUES(${id},${workspaceId},${ano},${mes},${Number(metaReceita||0)},${Number(metaDespesa||0)},${Number(metaLucro||0)})
    ON CONFLICT("workspaceId","ano","mes") DO UPDATE SET
      "metaReceita"=EXCLUDED."metaReceita",
      "metaDespesa"=EXCLUDED."metaDespesa",
      "metaLucro"=EXCLUDED."metaLucro"
  `

  const [row] = await prisma.$queryRaw`
    SELECT id,ano,mes,"metaReceita"::float,"metaDespesa"::float,"metaLucro"::float
    FROM "FinMeta" WHERE "workspaceId"=${workspaceId} AND ano=${ano} AND mes=${mes}
  ` as any[]

  return NextResponse.json(row, { status: 201 })
}
