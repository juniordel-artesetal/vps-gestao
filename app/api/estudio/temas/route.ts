// SOA Edition — "temas prontos" do workspace: templates marcados com temaNome (Astronauta,
// Ursinho Príncipe…). É a lista do pop-up do pedido — só aparece tema que já tem modelo pronto.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ctxEstudio } from '@/lib/estudio/ctx'

export const dynamic = 'force-dynamic'

export async function GET() {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  // Um tema por nome (se houver dois templates com o mesmo tema, vale o editado por último).
  const temas = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT ON (lower(t."temaNome")) t."id", t."temaNome", t."nome", t."preview"
     FROM "EstudioTemplate" t
     WHERE t."workspaceId"=$1 AND t."temaNome" IS NOT NULL AND t."temaNome" <> '' AND t."moldeAssetId" IS NOT NULL
     ORDER BY lower(t."temaNome"), t."updatedAt" DESC`, c.workspaceId)
  return NextResponse.json(serialize({ temas }))
}
