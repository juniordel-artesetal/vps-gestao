import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

// GET — produtos visíveis na loja com seus campos de vitrine (para a gestão).
// imagemLoja/imagem NUNCA entram no SELECT — só flags booleanas.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId

  const produtos = await prisma.$queryRaw`
    SELECT p."id", p."nome", p."lojaColecaoId", p."lojaOrdem", p."lojaDestaque",
           (p."imagemLoja" IS NOT NULL) AS "temImagemLoja",
           (p."imagem" IS NOT NULL)     AS "temImagemProduto",
           EXISTS (
             SELECT 1 FROM "PrecVariacao" v
             WHERE v."produtoId" = p."id" AND COALESCE(v."precoVenda", 0) > 0
           ) AS "temPreco"
    FROM "PrecProduto" p
    WHERE p."workspaceId" = ${workspaceId}
      AND p."ativo" = true
      AND p."visivelLoja" = true
    ORDER BY p."lojaOrdem" ASC, p."nome" ASC
  ` as any[]

  const colecoes = await prisma.$queryRaw`
    SELECT "id","nome","ordem","ativo"
    FROM "LojaColecao"
    WHERE "workspaceId" = ${workspaceId}
    ORDER BY "ordem" ASC, "createdAt" ASC
  ` as any[]

  return NextResponse.json(serialize({ produtos, colecoes }))
}
