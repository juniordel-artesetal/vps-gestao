// SOA Design — "Meus arquivos": ações em vários arquivos de uma vez (selecionar vários → mover / apagar).
// POST { acao: 'mover', ids, pasta } · { acao: 'excluir', ids }. Sempre só do próprio workspace.
import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { ctxEstudio, gid, storageConfigurado, urlDoBlob } from '@/lib/estudio/ctx'
import { normalizarCaminho, ancestrais } from '@/lib/estudio/pastas'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const b = await req.json().catch(() => ({}))
  const ids: string[] = Array.isArray(b.ids) ? [...new Set(b.ids.map(String))].slice(0, 500) as string[] : []
  if (!ids.length) return NextResponse.json({ error: 'Nenhum arquivo selecionado.' }, { status: 400 })

  if (b.acao === 'mover') {
    const pasta = normalizarCaminho(b.pasta)
    const n = await prisma.$executeRawUnsafe(
      `UPDATE "EstudioAsset" SET "pasta"=$3 WHERE "workspaceId"=$1 AND "id" = ANY($2::text[])`, c.workspaceId, ids, pasta)
    for (const p of pasta ? ancestrais(pasta) : []) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "EstudioPasta" ("id","workspaceId","caminho") VALUES ($1,$2,$3) ON CONFLICT ("workspaceId","caminho") DO NOTHING`, gid(), c.workspaceId, p)
    }
    return NextResponse.json({ ok: true, movidos: n })
  }

  if (b.acao === 'excluir') {
    const alvos = await prisma.$queryRawUnsafe<{ id: string; url: string; proxy: string | null }[]>(
      `SELECT "id","url","meta"->>'proxyUrl' AS proxy FROM "EstudioAsset" WHERE "workspaceId"=$1 AND "id" = ANY($2::text[])`, c.workspaceId, ids)
    await prisma.$executeRawUnsafe(`DELETE FROM "EstudioAsset" WHERE "workspaceId"=$1 AND "id" = ANY($2::text[])`, c.workspaceId, alvos.map(a => a.id))
    // só apaga do Blob o que nenhum outro arquivo da biblioteca ainda usa (mesma regra do DELETE unitário)
    for (const u of new Set(alvos.flatMap(a => [a.url, a.proxy]).filter((x): x is string => !!x))) {
      if (!storageConfigurado() || !urlDoBlob(u)) continue
      const [uso] = await prisma.$queryRawUnsafe<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM "EstudioAsset" WHERE "workspaceId"=$1 AND ("url"=$2 OR "meta"->>'proxyUrl'=$2)`, c.workspaceId, u)
      if (!uso?.n) { try { await del(u) } catch { /* já sumiu */ } }
    }
    return NextResponse.json({ ok: true, excluidos: alvos.length })
  }
  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}
