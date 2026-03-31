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

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const workspaceId = session.user.workspaceId
    const { searchParams } = new URL(req.url)

    const status       = searchParams.get('status')
    const freelancerId = searchParams.get('freelancerId')
    const pedidoId     = searchParams.get('pedidoId')
    const de           = searchParams.get('de')
    const ate          = searchParams.get('ate')

    const rows = await prisma.$queryRaw`
      SELECT
        d."id",
        d."pedidoId",
        COALESCE('#' || o."numero", d."pedidoId") AS "pedidoRef",
        d."freelancerId", f."nome" AS "freelancerNome",
        d."variacaoId", d."nomeProduto",
        d."qtdSolicitada"::int, d."qtdProduzida"::int,
        d."valorPorItem", d."valorTotal", d."status",
        d."observacoes", d."dataPagamento", d."createdAt", d."updatedAt"
      FROM "Demanda" d
      INNER JOIN "Freelancer" f ON f."id" = d."freelancerId"
      LEFT JOIN "Order" o ON o."id" = d."pedidoId"
      WHERE d."workspaceId" = ${workspaceId}
      ORDER BY d."createdAt" DESC
    ` as any[]

    let resultado = serialize(rows)
    if (status)       resultado = resultado.filter((d: any) => d.status === status)
    if (freelancerId) resultado = resultado.filter((d: any) => d.freelancerId === freelancerId)
    if (pedidoId)     resultado = resultado.filter((d: any) => d.pedidoId === pedidoId)
    if (de)           resultado = resultado.filter((d: any) => d.createdAt >= de)
    if (ate)          resultado = resultado.filter((d: any) => d.createdAt <= ate + 'T23:59:59')

    return NextResponse.json(resultado)
  } catch (error) {
    console.error('[GET demandas]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const workspaceId = session.user.workspaceId
    const body = await req.json()
    const { freelancerId, variacaoId, nomeProduto, qtdSolicitada, valorPorItem, pedidoId, observacoes, status } = body

    if (!freelancerId || !nomeProduto || !qtdSolicitada)
      return NextResponse.json({ error: 'freelancerId, nomeProduto e qtdSolicitada são obrigatórios' }, { status: 400 })

    // Verifica se o freelancer pertence ao workspace antes de inserir
    const freCheck = await prisma.$queryRaw`
      SELECT "id" FROM "Freelancer"
      WHERE "id" = ${freelancerId} AND "workspaceId" = ${workspaceId}
      LIMIT 1
    ` as any[]

    if (freCheck.length === 0)
      return NextResponse.json({ error: `Freelancer ${freelancerId} não encontrado no workspace ${workspaceId}` }, { status: 404 })

    const id    = Math.random().toString(36).slice(2) + Date.now().toString(36)
    const qtd   = parseInt(String(qtdSolicitada)) || 1
    const valor = parseFloat(String(valorPorItem)) || 0

    await prisma.$executeRaw`
      INSERT INTO "Demanda"
        ("id","workspaceId","pedidoId","freelancerId","variacaoId","nomeProduto",
         "qtdSolicitada","qtdProduzida","valorPorItem","valorTotal","status","observacoes")
      VALUES
        (${id}, ${workspaceId}, ${pedidoId || null}, ${freelancerId},
         ${variacaoId || null}, ${nomeProduto},
         ${qtd}, 0, ${valor}, 0,
         ${status || 'PENDENTE'}, ${observacoes || null})
    `

    return NextResponse.json({ ok: true, id })
  } catch (error) {
    console.error('[POST demandas]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
