// SOA Edition — renomear/mover/etiquetar/vincular a pedido, e excluir (apaga também no Blob).
import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { ctxEstudio, storageConfigurado, urlDoBlob } from '@/lib/estudio/ctx'

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
       "pedidoId" = CASE WHEN $6 THEN $7 ELSE "pedidoId" END,
       "meta" = "meta" || $8::jsonb
     WHERE "id"=$1 AND "workspaceId"=$2`,
    id, c.workspaceId,
    typeof b.nome === 'string' ? b.nome.slice(0, 200) : null,
    typeof b.pasta === 'string' ? b.pasta.slice(0, 120) : null,
    Array.isArray(b.tags) ? JSON.stringify(b.tags.map(String).slice(0, 30)) : null,
    'pedidoId' in b, b.pedidoId || null,
    // Só o vínculo "fonte editável" (design que gera este objeto inteligente) é gravável por aqui.
    JSON.stringify(typeof b.fonteDesignId === 'string' ? { fonteDesignId: b.fonteDesignId.slice(0, 40) } : {}))
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const { id } = await params
  const [a] = await prisma.$queryRawUnsafe<{ url: string; proxy: string | null }[]>(
    `SELECT "url", "meta"->>'proxyUrl' AS proxy FROM "EstudioAsset" WHERE "id"=$1 AND "workspaceId"=$2`, id, c.workspaceId)
  if (!a) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  await prisma.$executeRawUnsafe(`DELETE FROM "EstudioAsset" WHERE "id"=$1 AND "workspaceId"=$2`, id, c.workspaceId)
  // Só apaga do Blob o que nenhum outro arquivo da biblioteca ainda usa (fonte editável compartilha).
  for (const u of [a.url, a.proxy]) {
    if (!u || !storageConfigurado() || !urlDoBlob(u)) continue
    const [uso] = await prisma.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "EstudioAsset" WHERE "workspaceId"=$1 AND ("url"=$2 OR "meta"->>'proxyUrl'=$2)`, c.workspaceId, u)
    if (!uso?.n) { try { await del(u) } catch { /* já sumiu */ } }
  }
  // (Original no Drive dela não é URL do Blob: só some o LINK daqui; o arquivo continua no Drive dela.)
  return NextResponse.json({ ok: true })
}
