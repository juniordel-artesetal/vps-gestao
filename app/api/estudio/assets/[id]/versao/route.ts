// SOA Edition — OBJETO INTELIGENTE: troca o arquivo-fonte de um asset mantendo o MESMO id.
// Toda camada vinculada (em qualquer design) guarda só o assetId → na próxima abertura/render
// já mostra a versão nova. O arquivo anterior sai do Blob. Devolve em quantos designs é usado.
import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { ctxEstudio, storageConfigurado, urlDoBlob } from '@/lib/estudio/ctx'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const { id } = await params
  const b = await req.json().catch(() => ({}))
  if (!urlDoBlob(b.url) || !String(b.url).includes(`/estudio/${c.workspaceId}/`)) return NextResponse.json({ error: 'URL de arquivo inválida' }, { status: 400 })
  const proxyUrl = urlDoBlob(b.proxyUrl) && String(b.proxyUrl).includes(`/estudio/${c.workspaceId}/`) ? b.proxyUrl : null
  const [a] = await prisma.$queryRawUnsafe<{ url: string; proxy: string | null }[]>(
    `SELECT "url", "meta"->>'proxyUrl' AS proxy FROM "EstudioAsset" WHERE "id"=$1 AND "workspaceId"=$2 AND "tipo" IN ('molde','mockup','gerado','imagem')`, id, c.workspaceId)
  if (!a) return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
  await prisma.$executeRawUnsafe(
    `UPDATE "EstudioAsset" SET "url"=$3, "mime"=COALESCE($4,"mime"), "tamanhoBytes"=$5,
       "meta" = "meta" || jsonb_build_object('versao', COALESCE(("meta"->>'versao')::int, 1) + 1, 'trocadoEm', now()::text,
                                             'largura', $6::int, 'altura', $7::int, 'proxyUrl', $8::text)
     WHERE "id"=$1 AND "workspaceId"=$2`,
    id, c.workspaceId, b.url, typeof b.mime === 'string' ? b.mime : null, Math.max(0, Number(b.tamanhoBytes) || 0),
    Math.round(Number(b.largura) || 0), Math.round(Number(b.altura) || 0), proxyUrl)
  // Apaga a versão anterior do Blob — só se nenhum outro arquivo da biblioteca ainda usa a mesma URL
  // (a "fonte editável" de um objeto inteligente pode compartilhar o arquivo).
  for (const velha of [a.url, a.proxy]) {
    if (!velha || !storageConfigurado() || !urlDoBlob(velha) || velha === b.url || velha === proxyUrl) continue
    const [uso] = await prisma.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "EstudioAsset" WHERE "workspaceId"=$1 AND ("url"=$2 OR "meta"->>'proxyUrl'=$2)`, c.workspaceId, velha)
    if (!uso?.n) { try { await del(velha) } catch { /* já sumiu */ } }
  }
  const [u] = await prisma.$queryRawUnsafe<{ n: number }[]>(
    `SELECT count(*)::int AS n FROM "EstudioDesign" WHERE "workspaceId"=$1 AND "assetIds" @> jsonb_build_array($2::text)`, c.workspaceId, id)
  return NextResponse.json({ ok: true, url: b.url, proxyUrl, usadoEm: u?.n ?? 0 })
}
