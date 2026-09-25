// SOA Edition — presets salvos (ações em lote / conjuntos de tamanho): listar e criar.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ctxEstudio, gid } from '@/lib/estudio/ctx'

export const dynamic = 'force-dynamic'
const TIPOS = ['acao-lote', 'tamanho', 'efeito', 'estilo-texto']

export async function GET(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const tipo = new URL(req.url).searchParams.get('tipo')
  const presets = await prisma.$queryRawUnsafe(
    `SELECT "id","nome","tipo","operacoes","createdAt" FROM "EstudioPreset"
     WHERE "workspaceId"=$1 AND ($2::text IS NULL OR "tipo"=$2) ORDER BY "nome" LIMIT 200`, c.workspaceId, tipo)
  return NextResponse.json(serialize({ presets }))
}

export async function POST(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const b = await req.json().catch(() => ({}))
  const nome = String(b.nome || '').trim().slice(0, 120)
  if (!nome) return NextResponse.json({ error: 'Dê um nome ao preset.' }, { status: 400 })
  if (!TIPOS.includes(b.tipo)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  if (!Array.isArray(b.operacoes) || !b.operacoes.length || b.operacoes.length > 20) return NextResponse.json({ error: 'Operações inválidas' }, { status: 400 })
  const id = gid()
  await prisma.$executeRawUnsafe(
    `INSERT INTO "EstudioPreset" ("id","workspaceId","nome","tipo","operacoes") VALUES ($1,$2,$3,$4,$5::jsonb)`,
    id, c.workspaceId, nome, b.tipo, JSON.stringify(b.operacoes))
  return NextResponse.json({ id })
}
