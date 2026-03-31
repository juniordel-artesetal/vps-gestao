// Destino: app/api/fornecedores/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { searchParams } = new URL(req.url)
  const busca = searchParams.get('busca') || ''
  const ativo = searchParams.get('ativo')

  try {
    const rows = await prisma.$queryRaw`
      SELECT
        f.*,
        COALESCE(SUM(fc."valor"), 0)   AS "totalCompras",
        COALESCE(COUNT(fc.id)::int, 0) AS "qtdCompras",
        MAX(fc."data")                 AS "ultimaCompra"
      FROM "Fornecedor" f
      LEFT JOIN "FornecedorCompra" fc ON fc."fornecedorId" = f.id
      WHERE f."workspaceId" = ${workspaceId}
      GROUP BY f.id
      ORDER BY f."nome" ASC
    ` as any[]

    let result = rows
    if (busca) {
      const b = busca.toLowerCase()
      result = result.filter(f =>
        f.nome.toLowerCase().includes(b) ||
        (f.contato  || '').toLowerCase().includes(b) ||
        (f.email    || '').toLowerCase().includes(b) ||
        (f.whatsapp || '').toLowerCase().includes(b)
      )
    }
    if (ativo === 'true')  result = result.filter(f =>  f.ativo)
    if (ativo === 'false') result = result.filter(f => !f.ativo)

    return NextResponse.json(serialize(result))
  } catch (err) {
    console.error('[GET /api/fornecedores]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  try {
    const body = await req.json()
    const { nome, contato, email, whatsapp, cnpjCpf, categorias, observacoes, avaliacao } = body

    if (!nome?.trim())
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

    const id            = Math.random().toString(36).slice(2) + Date.now().toString(36)
    const categoriasStr = JSON.stringify(categorias || [])
    const av            = Math.min(5, Math.max(1, Number(avaliacao) || 5))

    await prisma.$executeRaw`
      INSERT INTO "Fornecedor"
        ("id","workspaceId","nome","contato","email","whatsapp","cnpjCpf",
         "categorias","observacoes","avaliacao","ativo","createdAt","updatedAt")
      VALUES
        (${id}, ${workspaceId}, ${nome.trim()},
         ${contato || null}, ${email || null}, ${whatsapp || null}, ${cnpjCpf || null},
         ${categoriasStr}, ${observacoes || null}, ${av}, true, NOW(), NOW())
    `

    const rows = await prisma.$queryRaw`
      SELECT *, 0 AS "totalCompras", 0 AS "qtdCompras", NULL AS "ultimaCompra"
      FROM "Fornecedor" WHERE id = ${id}
    ` as any[]

    return NextResponse.json(serialize(rows[0]), { status: 201 })
  } catch (err) {
    console.error('[POST /api/fornecedores]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
