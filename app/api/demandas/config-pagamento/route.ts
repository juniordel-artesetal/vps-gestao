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

// GET — lista todas as variações ativas com o valor configurado
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId
  const { searchParams } = new URL(req.url)
  const variacaoId = searchParams.get('variacaoId')

  // Se pediu um específico, retorna só o valor configurado
  if (variacaoId) {
    const rows = await prisma.$queryRaw`
      SELECT "valorPorItem" FROM "DemandaConfigPagamento"
      WHERE "workspaceId" = ${workspaceId} AND "variacaoId" = ${variacaoId}
      LIMIT 1
    ` as any[]
    return NextResponse.json(serialize(rows[0] || { valorPorItem: 0 }))
  }

  // Lista todas as variações com o valor configurado (ou 0)
  const rows = await prisma.$queryRaw`
    SELECT
      v."id"                                   AS "variacaoId",
      p."nome"                                 AS "produtoNome",
      p."sku",
      v."canal",
      v."tipo",
      v."subOpcao",
      COALESCE(v."custoTotal", 0)              AS "custoTotal",
      COALESCE(c."valorPorItem", 0)            AS "valorPorItem",
      c."updatedAt"
    FROM "PrecVariacao" v
    INNER JOIN "PrecProduto" p ON p."id" = v."produtoId"
    LEFT JOIN "DemandaConfigPagamento" c
           ON c."variacaoId"  = v."id"
          AND c."workspaceId" = ${workspaceId}
    WHERE p."workspaceId" = ${workspaceId}
      AND p."ativo" = true
    ORDER BY p."nome", v."canal", v."tipo"
  ` as any[]

  return NextResponse.json(serialize(rows))
}

// POST — salva/atualiza valor por item para uma variação
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId
  const { variacaoId, nomeProduto, valorPorItem } = await req.json()

  if (!variacaoId) return NextResponse.json({ error: 'variacaoId obrigatório' }, { status: 400 })

  const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
  await prisma.$executeRaw`
    INSERT INTO "DemandaConfigPagamento"
      ("id","workspaceId","variacaoId","nomeProduto","valorPorItem","updatedAt")
    VALUES
      (${id}, ${workspaceId}, ${variacaoId}, ${nomeProduto || ''}, ${parseFloat(valorPorItem) || 0}, NOW())
    ON CONFLICT ("workspaceId","variacaoId")
    DO UPDATE SET
      "valorPorItem" = ${parseFloat(valorPorItem) || 0},
      "nomeProduto"  = ${nomeProduto || ''},
      "updatedAt"    = NOW()
  `
  return NextResponse.json({ ok: true })
}
