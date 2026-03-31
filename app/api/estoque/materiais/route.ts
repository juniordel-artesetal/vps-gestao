// Destino: app/api/estoque/materiais/route.ts
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

// GET — lista materiais no estoque (?disponiveis=1 retorna os que ainda não estão)
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId
  const { searchParams } = new URL(req.url)
  const disponiveis = searchParams.get('disponiveis') === '1'

  if (disponiveis) {
    const rows = await prisma.$queryRaw`
      SELECT
        m."id"                           AS "materialId",
        m."nome",
        m."unidade",
        COALESCE(m."precoUnidade", 0)    AS "precoUnidade",
        COALESCE(m."precoPacote",  0)    AS "precoPacote",
        COALESCE(m."qtdPacote",    1)    AS "qtdPacote",
        m."fornecedor"
      FROM "PrecMaterial" m
      WHERE m."workspaceId" = ${workspaceId}
        AND m."ativo" = true
        AND NOT EXISTS (
          SELECT 1 FROM "EstMaterialSaldo" s
          WHERE s."materialId"  = m."id"
            AND s."workspaceId" = ${workspaceId}
        )
      ORDER BY m."nome"
    ` as any[]
    return NextResponse.json(serialize(rows))
  }

  // ── Retorna materiais monitorados com saldo e podeZerar ──────────────────
  const rows = await prisma.$queryRaw`
    SELECT
      m."id"                                       AS "materialId",
      m."nome",
      m."unidade",
      COALESCE(m."precoUnidade", 0)                AS "precoUnidade",
      COALESCE(m."precoPacote",  0)                AS "precoPacote",
      COALESCE(m."qtdPacote",    1)                AS "qtdPacote",
      m."fornecedor",
      COALESCE(s."saldoAtual",    0)               AS "saldoAtual",
      COALESCE(s."estoqueMinimo", 0)               AS "estoqueMinimo",
      COALESCE(s."podeZerar",     false)           AS "podeZerar",
      s."updatedAt"                                AS "ultimaMovimentacao"
    FROM "PrecMaterial" m
    INNER JOIN "EstMaterialSaldo" s
           ON s."materialId"  = m."id"
          AND s."workspaceId" = ${workspaceId}
    WHERE m."workspaceId" = ${workspaceId}
      AND m."ativo" = true
    ORDER BY m."nome"
  ` as any[]

  return NextResponse.json(serialize(rows))
}

// POST — adicionar materiais ao estoque
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId
  const { materialIds } = await req.json()

  if (!Array.isArray(materialIds) || materialIds.length === 0)
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  for (const materialId of materialIds) {
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    await prisma.$executeRaw`
      INSERT INTO "EstMaterialSaldo"
        ("id","workspaceId","materialId","saldoAtual","estoqueMinimo","podeZerar","updatedAt")
      VALUES (${id}, ${workspaceId}, ${materialId}, 0, 0, false, NOW())
      ON CONFLICT ("workspaceId","materialId") DO NOTHING
    `
  }

  return NextResponse.json({ ok: true })
}
