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

// GET — lista produtos no estoque (?disponiveis=1 retorna os que ainda não estão)
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { searchParams } = new URL(req.url)
  const disponiveis = searchParams.get('disponiveis') === '1'

  if (disponiveis) {
    const rows = await prisma.$queryRaw`
      SELECT
        v."id"          AS "variacaoId",
        v."produtoId",
        p."nome"        AS "produtoNome",
        p."sku",
        v."canal",
        v."tipo",
        v."subOpcao",
        v."isKit",
        COALESCE(v."custoTotal", 0)   AS "custoTotal",
        COALESCE(v."precoVenda", 0)   AS "precoVenda"
      FROM "PrecVariacao" v
      INNER JOIN "PrecProduto" p ON p."id" = v."produtoId"
      WHERE p."workspaceId" = ${workspaceId}
        AND p."ativo" = true
        AND v."incluirEstoque" = false
      ORDER BY p."nome", v."canal", v."tipo"
    ` as any[]
    return NextResponse.json(serialize(rows))
  }

  // Produtos no estoque com saldo e valores dos campos customizados
  const rows = await prisma.$queryRaw`
    SELECT
      v."id"                                      AS "variacaoId",
      v."produtoId",
      p."nome"                                    AS "produtoNome",
      p."sku",
      v."canal",
      v."tipo",
      v."subOpcao",
      v."isKit",
      COALESCE(v."custoTotal", 0)                 AS "custoTotal",
      COALESCE(v."precoVenda", 0)                 AS "precoVenda",
      COALESCE(s."saldoAtual",    0)::int         AS "saldoAtual",
      COALESCE(s."estoqueMinimo", 0)::int         AS "estoqueMinimo",
      s."updatedAt"                               AS "ultimaMovimentacao"
    FROM "PrecVariacao" v
    INNER JOIN "PrecProduto" p ON p."id" = v."produtoId"
    LEFT JOIN "EstProdutoSaldo" s
           ON s."variacaoId"  = v."id"
          AND s."workspaceId" = ${workspaceId}
    WHERE p."workspaceId"    = ${workspaceId}
      AND p."ativo"          = true
      AND v."incluirEstoque" = true
    ORDER BY p."nome", v."canal", v."tipo"
  ` as any[]

  const serialized = serialize(rows)

  // Para cada variação, buscar os valores dos campos customizados
  if (serialized.length > 0) {
    const variacaoIds = serialized.map((r: any) => r.variacaoId)

    // Busca todos os valores de uma vez
    const valores = await prisma.$queryRaw`
      SELECT "variacaoId", "campoId", "valor"
      FROM "EstCampoValor"
      WHERE "workspaceId" = ${workspaceId}
        AND "variacaoId" = ANY(${variacaoIds}::text[])
    ` as any[]

    // Agrupa valores por variacaoId
    const valoresPorVariacao: Record<string, Record<string, string>> = {}
    for (const v of valores) {
      if (!valoresPorVariacao[v.variacaoId]) valoresPorVariacao[v.variacaoId] = {}
      valoresPorVariacao[v.variacaoId][v.campoId] = v.valor
    }

    // Injeta no resultado
    for (const item of serialized) {
      item.camposValores = valoresPorVariacao[item.variacaoId] || {}
    }
  }

  return NextResponse.json(serialized)
}

// POST — adicionar variações ao estoque
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { variacaoIds } = await req.json()

  if (!Array.isArray(variacaoIds) || variacaoIds.length === 0)
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  for (const variacaoId of variacaoIds) {
    await prisma.$executeRaw`
      UPDATE "PrecVariacao"
      SET "incluirEstoque" = true
      WHERE "id" = ${variacaoId}
        AND EXISTS (
          SELECT 1 FROM "PrecProduto" p
          WHERE p."id" = "PrecVariacao"."produtoId"
            AND p."workspaceId" = ${workspaceId}
        )
    `
    const saldoId = Math.random().toString(36).slice(2) + Date.now().toString(36)
    await prisma.$executeRaw`
      INSERT INTO "EstProdutoSaldo"
        ("id","workspaceId","variacaoId","saldoAtual","estoqueMinimo","updatedAt")
      VALUES (${saldoId}, ${workspaceId}, ${variacaoId}, 0, 0, NOW())
      ON CONFLICT ("workspaceId","variacaoId") DO NOTHING
    `
  }

  return NextResponse.json({ ok: true })
}
