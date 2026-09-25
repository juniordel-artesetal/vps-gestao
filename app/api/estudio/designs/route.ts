// SOA Edition — designs do editor de camadas (Fase 2): listar e criar.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ctxEstudio, gid } from '@/lib/estudio/ctx'

export const dynamic = 'force-dynamic'

export async function GET() {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const designs = await prisma.$queryRawUnsafe(
    `SELECT "id","nome","largura","altura","previewUrl","updatedAt" FROM "EstudioDesign"
     WHERE "workspaceId"=$1 ORDER BY "updatedAt" DESC LIMIT 200`, c.workspaceId)
  return NextResponse.json(serialize({ designs }))
}

export async function POST(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const b = await req.json().catch(() => ({}))
  const largura = Math.round(Number(b.largura)), altura = Math.round(Number(b.altura))
  if (!(largura >= 50 && largura <= 8000 && altura >= 50 && altura <= 8000)) return NextResponse.json({ error: 'Tamanho entre 50 e 8000 px.' }, { status: 400 })
  const nome = String(b.nome || 'Novo design').trim().slice(0, 150) || 'Novo design'
  const id = gid()
  await prisma.$executeRawUnsafe(
    `INSERT INTO "EstudioDesign" ("id","workspaceId","userId","nome","largura","altura","json") VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    id, c.workspaceId, c.userId, nome, largura, altura, JSON.stringify(b.json && typeof b.json === 'object' ? b.json : {}))
  return NextResponse.json({ id })
}
