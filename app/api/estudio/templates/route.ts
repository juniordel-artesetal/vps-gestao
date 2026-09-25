// SOA Edition — templates reutilizáveis (molde + caixas de campo).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ctxEstudio, gid } from '@/lib/estudio/ctx'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  // ?tipo=kit-caixas → só os temas do Método Mãe; sem tipo → só os templates da Edição em massa
  const kit = new URL(req.url).searchParams.get('tipo') === 'kit-caixas'
  const rows = await prisma.$queryRawUnsafe(
    `SELECT t."id", t."nome", t."moldeAssetId", t."preview", t."updatedAt", t."temaNome",
            a."url" AS "moldeUrl", a."nome" AS "moldeNome"
     FROM "EstudioTemplate" t LEFT JOIN "EstudioAsset" a ON a."id"=t."moldeAssetId" AND a."workspaceId"=t."workspaceId"
     WHERE t."workspaceId"=$1 AND (COALESCE(t."config"->>'tipo','') = 'kit-caixas') = $2
     ORDER BY t."updatedAt" DESC LIMIT 200`, c.workspaceId, kit)
  return NextResponse.json(serialize({ templates: rows }))
}

export async function POST(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const b = await req.json().catch(() => ({}))
  const nome = String(b.nome || '').trim().slice(0, 150)
  if (!nome) return NextResponse.json({ error: 'Dê um nome ao template' }, { status: 400 })
  if (!b.config || typeof b.config !== 'object') return NextResponse.json({ error: 'Configuração inválida' }, { status: 400 })
  const id = gid()
  await prisma.$executeRawUnsafe(
    `INSERT INTO "EstudioTemplate" ("id","workspaceId","nome","moldeAssetId","config","preview","temaNome") VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)`,
    id, c.workspaceId, nome, b.moldeAssetId || null, JSON.stringify(b.config),
    typeof b.preview === 'string' ? b.preview.slice(0, 300_000) : null,
    typeof b.temaNome === 'string' && b.temaNome.trim() ? b.temaNome.trim().slice(0, 80) : null)
  return NextResponse.json({ id })
}
