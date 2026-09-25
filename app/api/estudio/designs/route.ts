// SOA Edition — designs do editor de camadas (Fase 2): listar e criar.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ctxEstudio, gid } from '@/lib/estudio/ctx'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const modelos = new URL(req.url).searchParams.get('modelos') === '1'
  // A lista normal esconde os designs-FONTE de objeto inteligente (são abertos pelo "Editar fonte").
  const designs = await prisma.$queryRawUnsafe(
    `SELECT "id","nome","largura","altura","previewUrl","updatedAt","ehModelo" FROM "EstudioDesign"
     WHERE "workspaceId"=$1 AND ($2::boolean = false OR "ehModelo") AND "fonteAssetId" IS NULL
     ORDER BY "updatedAt" DESC LIMIT 200`, c.workspaceId, modelos)
  return NextResponse.json(serialize({ designs }))
}

export async function POST(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const b = await req.json().catch(() => ({}))
  // Duplicar (usar um template meu): copia tudo de um design do MESMO workspace.
  if (typeof b.duplicarDe === 'string') {
    const id = gid()
    const n = await prisma.$executeRawUnsafe(
      `INSERT INTO "EstudioDesign" ("id","workspaceId","userId","nome","largura","altura","json","assetIds","previewUrl")
       SELECT $1, "workspaceId", $3, COALESCE($4, "nome" || ' (cópia)'), "largura", "altura", "json", "assetIds", "previewUrl"
       FROM "EstudioDesign" WHERE "id"=$2 AND "workspaceId"=$5`,
      id, b.duplicarDe, c.userId, typeof b.nome === 'string' && b.nome.trim() ? b.nome.trim().slice(0, 150) : null, c.workspaceId)
    if (!n) return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })
    return NextResponse.json({ id })
  }
  const largura = Math.round(Number(b.largura)), altura = Math.round(Number(b.altura))
  if (!(largura >= 50 && largura <= 8000 && altura >= 50 && altura <= 8000)) return NextResponse.json({ error: 'Tamanho entre 50 e 8000 px.' }, { status: 400 })
  const nome = String(b.nome || 'Novo design').trim().slice(0, 150) || 'Novo design'
  const id = gid()
  await prisma.$executeRawUnsafe(
    `INSERT INTO "EstudioDesign" ("id","workspaceId","userId","nome","largura","altura","json") VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    id, c.workspaceId, c.userId, nome, largura, altura, JSON.stringify(b.json && typeof b.json === 'object' ? b.json : {}))
  return NextResponse.json({ id })
}
