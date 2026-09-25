// SOA Edition — abrir / atualizar / excluir um template.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ctxEstudio } from '@/lib/estudio/ctx'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const { id } = await params
  const [t] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT t."id", t."nome", t."moldeAssetId", t."config", t."updatedAt", t."temaNome",
            a."url" AS "moldeUrl", a."mime" AS "moldeMime", a."meta" AS "moldeMeta"
     FROM "EstudioTemplate" t LEFT JOIN "EstudioAsset" a ON a."id"=t."moldeAssetId" AND a."workspaceId"=t."workspaceId"
     WHERE t."id"=$1 AND t."workspaceId"=$2`, id, c.workspaceId)
  if (!t) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json(serialize({ template: t }))
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const { id } = await params
  const b = await req.json().catch(() => ({}))
  await prisma.$executeRawUnsafe(
    `UPDATE "EstudioTemplate" SET
       "nome" = COALESCE($3, "nome"),
       "moldeAssetId" = COALESCE($4, "moldeAssetId"),
       "config" = COALESCE($5::jsonb, "config"),
       "preview" = COALESCE($6, "preview"),
       "temaNome" = CASE WHEN $7 THEN $8 ELSE "temaNome" END,
       "updatedAt" = NOW()
     WHERE "id"=$1 AND "workspaceId"=$2`,
    id, c.workspaceId,
    typeof b.nome === 'string' && b.nome.trim() ? b.nome.trim().slice(0, 150) : null,
    b.moldeAssetId || null,
    b.config && typeof b.config === 'object' ? JSON.stringify(b.config) : null,
    typeof b.preview === 'string' ? b.preview.slice(0, 300_000) : null,
    'temaNome' in b, typeof b.temaNome === 'string' && b.temaNome.trim() ? b.temaNome.trim().slice(0, 80) : null)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const { id } = await params
  await prisma.$executeRawUnsafe(`DELETE FROM "EstudioTemplate" WHERE "id"=$1 AND "workspaceId"=$2`, id, c.workspaceId)
  return NextResponse.json({ ok: true })
}
