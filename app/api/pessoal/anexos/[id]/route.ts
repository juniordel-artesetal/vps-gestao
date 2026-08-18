// Remover anexo: apaga do Vercel Blob e a linha. Escopo por userId (só o dono remove).
import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { guardPessoal } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const [anexo] = await prisma.$queryRaw`
    SELECT "url" FROM "PessoalAnexo" WHERE "id" = ${id} AND "userId" = ${g.userId}
  ` as { url: string }[]
  if (!anexo) return NextResponse.json({ error: 'Anexo não encontrado' }, { status: 404 })
  // Best-effort no Blob: se falhar, ainda removemos a referência do banco.
  try { if (process.env.BLOB_READ_WRITE_TOKEN) await del(anexo.url, { token: process.env.BLOB_READ_WRITE_TOKEN }) } catch {}
  await prisma.$executeRaw`DELETE FROM "PessoalAnexo" WHERE "id" = ${id} AND "userId" = ${g.userId}`
  return NextResponse.json({ ok: true })
}
