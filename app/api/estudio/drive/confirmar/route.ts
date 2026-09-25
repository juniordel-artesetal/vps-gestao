// SOA Edition — confirma o arquivo enviado ao Drive dela e (opcional) registra na biblioteca como
// 'original' — só o LINK fica no banco; o binário pesado mora no Drive dela.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ctxEstudio, gid } from '@/lib/estudio/ctx'
import { confirmarArquivo } from '@/lib/estudio/drive'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const b = await req.json().catch(() => ({}))
  if (typeof b.fileId !== 'string' || !b.fileId) return NextResponse.json({ error: 'Arquivo inválido' }, { status: 400 })
  const f = await confirmarArquivo(c.workspaceId, c.userId, b.fileId)
  if (!f) return NextResponse.json({ error: 'Não achei o arquivo no seu Drive.' }, { status: 404 })
  let assetId: string | null = null
  if (b.registrar) {
    assetId = gid()
    await prisma.$executeRawUnsafe(
      `INSERT INTO "EstudioAsset" ("id","workspaceId","userId","tipo","nome","url","mime","tamanhoBytes","pasta","tags","meta")
       VALUES ($1,$2,$3,'original',$4,$5,$6,$7,$8,'[]'::jsonb,$9::jsonb)`,
      assetId, c.workspaceId, c.userId, String(b.nome || f.nome).slice(0, 200), f.link, f.mime, f.tamanho,
      String(b.pasta || 'Originais (Drive)').slice(0, 120),
      JSON.stringify({ drive: { fileId: f.id }, copiaDeTrabalho: typeof b.copiaAssetId === 'string' ? b.copiaAssetId : null }))
  }
  return NextResponse.json({ link: f.link, assetId })
}
