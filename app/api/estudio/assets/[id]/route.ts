// SOA Edition — renomear/mover/etiquetar/vincular a pedido, e excluir (apaga também no Blob).
import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { ctxEstudio, storageConfigurado } from '@/lib/estudio/ctx'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const { id } = await params
  const b = await req.json().catch(() => ({}))
  await prisma.$executeRawUnsafe(
    `UPDATE "EstudioAsset" SET
       "nome"  = COALESCE($3, "nome"),
       "pasta" = COALESCE($4, "pasta"),
       "tags"  = COALESCE($5::jsonb, "tags"),
       "pedidoId" = CASE WHEN $6 THEN $7 ELSE "pedidoId" END
     WHERE "id"=$1 AND "workspaceId"=$2`,
    id, c.workspaceId,
    typeof b.nome === 'string' ? b.nome.slice(0, 200) : null,
    typeof b.pasta === 'string' ? b.pasta.slice(0, 120) : null,
    Array.isArray(b.tags) ? JSON.stringify(b.tags.map(String).slice(0, 30)) : null,
    'pedidoId' in b, b.pedidoId || null)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const { id } = await params
  const [a] = await prisma.$queryRawUnsafe<{ url: string }[]>(`SELECT "url" FROM "EstudioAsset" WHERE "id"=$1 AND "workspaceId"=$2`, id, c.workspaceId)
  if (!a) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  if (storageConfigurado()) { try { await del(a.url) } catch { /* arquivo já sumiu — segue apagando o registro */ } }
  await prisma.$executeRawUnsafe(`DELETE FROM "EstudioAsset" WHERE "id"=$1 AND "workspaceId"=$2`, id, c.workspaceId)
  return NextResponse.json({ ok: true })
}
