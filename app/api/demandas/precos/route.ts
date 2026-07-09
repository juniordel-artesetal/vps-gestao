import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDemandaTables } from '../_lib/schema'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

// GET — lista os preços por peça cadastrados (com nome do freelancer quando houver)
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    await ensureDemandaTables()

    const workspaceId = session.user.workspaceId
    const { searchParams } = new URL(req.url)
    const freelancerId = searchParams.get('freelancerId')
    const soAtivos     = searchParams.get('ativos') === '1'

    const rows = await prisma.$queryRaw`
      SELECT
        p."id", p."freelancerId", f."nome" AS "freelancerNome",
        p."produto", p."valorUnitario", p."ativo",
        p."createdAt", p."updatedAt"
      FROM "DemandaPreco" p
      LEFT JOIN "Freelancer" f ON f."id" = p."freelancerId"
      WHERE p."workspaceId" = ${workspaceId}
      ORDER BY p."produto" ASC
    ` as any[]

    let resultado = serialize(rows)
    // Filtro de freelancer: mostra os do freelancer + os gerais (sem freelancer)
    if (freelancerId) resultado = resultado.filter((r: any) => r.freelancerId === freelancerId || !r.freelancerId)
    if (soAtivos)     resultado = resultado.filter((r: any) => r.ativo === true)

    return NextResponse.json(resultado)
  } catch (error) {
    console.error('[GET demandas/precos]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// POST — cadastra um preço por peça
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    await ensureDemandaTables()

    const workspaceId = session.user.workspaceId
    const { produto, valorUnitario, freelancerId } = await req.json()

    if (!produto?.trim())
      return NextResponse.json({ error: 'Produto é obrigatório' }, { status: 400 })

    const id    = Math.random().toString(36).slice(2) + Date.now().toString(36)
    const valor = parseFloat(String(valorUnitario)) || 0

    await prisma.$executeRaw`
      INSERT INTO "DemandaPreco"
        ("id","workspaceId","freelancerId","produto","valorUnitario","ativo","createdAt","updatedAt")
      VALUES
        (${id}, ${workspaceId}, ${freelancerId || null}, ${produto.trim()}, ${valor}, true, NOW(), NOW())
    `
    return NextResponse.json({ ok: true, id })
  } catch (error) {
    console.error('[POST demandas/precos]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
