// SOA Edition — abrir / salvar (autosave) / excluir um design. Ao abrir, devolve a URL ATUAL de
// cada objeto inteligente (assetId → url): trocar o arquivo-fonte reflete em todos os designs.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ctxEstudio } from '@/lib/estudio/ctx'

export const dynamic = 'force-dynamic'
const MAX_JSON = 2_000_000 // ~2 MB: imagem NUNCA vai embutida — só referência de asset

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const { id } = await params
  const [d] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id","nome","largura","altura","json","assetIds","updatedAt","fonteAssetId","ehModelo" FROM "EstudioDesign" WHERE "id"=$1 AND "workspaceId"=$2`, id, c.workspaceId)
  if (!d) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  const ids: string[] = Array.isArray(d.assetIds) ? d.assetIds : []
  if (d.fonteAssetId && !ids.includes(d.fonteAssetId)) ids.push(d.fonteAssetId)
  const assets = ids.length ? await prisma.$queryRawUnsafe(
    `SELECT "id","url","nome","meta" FROM "EstudioAsset" WHERE "workspaceId"=$1 AND "id" = ANY($2::text[])`, c.workspaceId, ids) : []
  return NextResponse.json(serialize({ design: d, assets }))
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const { id } = await params
  const b = await req.json().catch(() => ({}))
  const json = b.json && typeof b.json === 'object' ? JSON.stringify(b.json) : null
  if (json && json.length > MAX_JSON) return NextResponse.json({ error: 'Design grande demais para salvar (imagem embutida?).' }, { status: 413 })
  const assetIds = Array.isArray(b.assetIds) ? JSON.stringify([...new Set(b.assetIds.map(String))].slice(0, 500)) : null
  const largura = Number(b.largura) >= 50 && Number(b.largura) <= 8000 ? Math.round(Number(b.largura)) : null
  const altura = Number(b.altura) >= 50 && Number(b.altura) <= 8000 ? Math.round(Number(b.altura)) : null
  const n = await prisma.$executeRawUnsafe(
    `UPDATE "EstudioDesign" SET
       "nome" = COALESCE($3, "nome"), "json" = COALESCE($4::jsonb, "json"), "assetIds" = COALESCE($5::jsonb, "assetIds"),
       "previewUrl" = COALESCE($6, "previewUrl"), "largura" = COALESCE($7, "largura"), "altura" = COALESCE($8, "altura"),
       "fonteAssetId" = CASE WHEN $9 THEN $10 ELSE "fonteAssetId" END,
       "ehModelo" = COALESCE($11, "ehModelo"), "updatedAt" = NOW()
     WHERE "id"=$1 AND "workspaceId"=$2`,
    id, c.workspaceId,
    typeof b.nome === 'string' && b.nome.trim() ? b.nome.trim().slice(0, 150) : null, json, assetIds,
    typeof b.previewUrl === 'string' && b.previewUrl.length < 200_000 ? b.previewUrl : null, largura, altura,
    'fonteAssetId' in b, typeof b.fonteAssetId === 'string' ? b.fonteAssetId : null,
    typeof b.ehModelo === 'boolean' ? b.ehModelo : null)
  if (!n) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  // Histórico: snapshot automático no máximo a cada 5 min (ou forçado com `versao`), guardando os 30 últimos.
  let versao: string | null = null
  if (json) {
    try {
      const forcar = typeof b.versao === 'string' && b.versao.trim() ? b.versao.trim().slice(0, 40) : null
      const [ult] = await prisma.$queryRawUnsafe<{ criadoEm: Date }[]>(
        `SELECT "criadoEm" FROM "EstudioDesignVersao" WHERE "designId"=$1 AND "workspaceId"=$2 ORDER BY "criadoEm" DESC LIMIT 1`, id, c.workspaceId)
      if (forcar || !ult || Date.now() - new Date(ult.criadoEm).getTime() > 5 * 60_000) {
        versao = Math.random().toString(36).slice(2) + Date.now().toString(36)
        await prisma.$executeRawUnsafe(
          `INSERT INTO "EstudioDesignVersao" ("id","workspaceId","designId","userId","json","assetIds","previewUrl","motivo")
           VALUES ($1,$2,$3,$4,$5::jsonb,COALESCE($6::jsonb,'[]'::jsonb),$7,$8)`,
          versao, c.workspaceId, id, c.userId, json, assetIds,
          typeof b.previewUrl === 'string' && b.previewUrl.length < 200_000 ? b.previewUrl : null, forcar || 'auto')
        await prisma.$executeRawUnsafe(
          `DELETE FROM "EstudioDesignVersao" WHERE "designId"=$1 AND "workspaceId"=$2 AND "id" NOT IN (
             SELECT "id" FROM "EstudioDesignVersao" WHERE "designId"=$1 AND "workspaceId"=$2 ORDER BY "criadoEm" DESC LIMIT 30)`, id, c.workspaceId)
      }
    } catch (e) { console.error('[ESTUDIO_DESIGN_VERSAO]', (e as Error).message) } // histórico nunca derruba o salvamento
  }
  return NextResponse.json({ ok: true, salvoEm: new Date().toISOString(), versao })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const { id } = await params
  await prisma.$executeRawUnsafe(`DELETE FROM "EstudioDesign" WHERE "id"=$1 AND "workspaceId"=$2`, id, c.workspaceId)
  return NextResponse.json({ ok: true })
}
