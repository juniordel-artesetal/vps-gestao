// app/api/financeiro/categorias/route.ts
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
  const tipo  = searchParams.get('tipo')
  const vTipo = ['RECEITA','DESPESA'].includes(tipo || '') ? tipo : null

  const rows = vTipo
    ? await prisma.$queryRaw`SELECT * FROM "FinCategoria" WHERE "workspaceId"=${workspaceId} AND tipo=${vTipo} ORDER BY nome`
    : await prisma.$queryRaw`SELECT * FROM "FinCategoria" WHERE "workspaceId"=${workspaceId} ORDER BY tipo,nome`

  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { nome, tipo, cor, icone } = await req.json()
  if (!nome || !tipo) return NextResponse.json({ error: 'nome e tipo são obrigatórios' }, { status: 400 })

  const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
  await prisma.$executeRaw`INSERT INTO "FinCategoria"("id","workspaceId","nome","tipo","cor","icone") VALUES(${id},${workspaceId},${nome},${tipo},${cor ?? '#f97316'},${icone ?? '📁'})`

  const [row] = await prisma.$queryRaw`SELECT * FROM "FinCategoria" WHERE id=${id}` as any[]
  return NextResponse.json(row, { status: 201 })
}
