// SOA Edition — biblioteca de arquivos (moldes, fontes, artes geradas). Só metadados + URL.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ctxEstudio, gid, urlDoBlob } from '@/lib/estudio/ctx'

export const dynamic = 'force-dynamic'
const TIPOS = ['molde', 'fonte', 'gerado', 'mockup']

export async function GET(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const q = new URL(req.url).searchParams
  const tipo = q.get('tipo'), pasta = q.get('pasta'), pedidoId = q.get('pedidoId')
  const rows = await prisma.$queryRawUnsafe(
    `SELECT "id","tipo","nome","url","mime","tamanhoBytes","pasta","tags","pedidoId","meta","createdAt","sugeridaGlobal","aprovadaGlobal"
     FROM "EstudioAsset"
     WHERE "workspaceId"=$1
       AND ($2::text IS NULL OR "tipo"=$2)
       AND ($3::text IS NULL OR "pasta"=$3)
       AND ($4::text IS NULL OR "pedidoId"=$4)
     ORDER BY "createdAt" DESC LIMIT 500`,
    c.workspaceId, tipo, pasta, pedidoId)
  return NextResponse.json(serialize({ assets: rows }))
}

export async function POST(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const b = await req.json().catch(() => ({}))
  if (!TIPOS.includes(b.tipo)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  if (!urlDoBlob(b.url)) return NextResponse.json({ error: 'URL de arquivo inválida' }, { status: 400 })
  if (!String(b.url).includes(`/estudio/${c.workspaceId}/`)) return NextResponse.json({ error: 'Arquivo de outro workspace' }, { status: 400 })
  const nome = String(b.nome || 'arquivo').slice(0, 200)
  const id = gid()
  await prisma.$executeRawUnsafe(
    `INSERT INTO "EstudioAsset" ("id","workspaceId","tipo","nome","url","mime","tamanhoBytes","pasta","tags","pedidoId","meta","userId")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11::jsonb,$12)`,
    id, c.workspaceId, b.tipo, nome, b.url, b.mime || null, Math.max(0, Number(b.tamanhoBytes) || 0),
    String(b.pasta || '').slice(0, 120), JSON.stringify(Array.isArray(b.tags) ? b.tags.map(String).slice(0, 30) : []),
    b.pedidoId || null, JSON.stringify(b.meta && typeof b.meta === 'object' ? b.meta : {}), c.userId)
  return NextResponse.json({ id })
}
