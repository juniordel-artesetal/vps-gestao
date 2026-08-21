// Status do checklist de Primeiros Passos (pós-onboarding). Escopo por workspace da sessão.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const ws = session.user.workspaceId
  const [r] = await prisma.$queryRaw`
    SELECT
      EXISTS (SELECT 1 FROM "SetorConfig" WHERE "workspaceId" = ${ws}) AS "setores",
      EXISTS (SELECT 1 FROM "PrecMaterial" WHERE "workspaceId" = ${ws} AND COALESCE("precoUnidade",0) > 0) AS "precoMaterial",
      EXISTS (SELECT 1 FROM "PrecProduto" WHERE "workspaceId" = ${ws}) AS "produtos",
      EXISTS (SELECT 1 FROM "Order" WHERE "workspaceId" = ${ws}) AS "pedido"
  ` as any[]
  return NextResponse.json({
    setores: !!r.setores, precoMaterial: !!r.precoMaterial, produtos: !!r.produtos, pedido: !!r.pedido,
  })
}
