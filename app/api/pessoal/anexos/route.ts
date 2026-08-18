// Anexos das Notas (Fase 3 — Vercel Blob). POST(upload multipart) + GET(?nota= lista). Escopo por userId.
// Sem BLOB_READ_WRITE_TOKEN a rota responde 501 (feature indisponível) — não quebra o resto do módulo.
import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize, gid } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

const MAX = 10 * 1024 * 1024 // 10 MB
const TIPOS_OK = /^(image\/(png|jpe?g|gif|webp|svg\+xml)|application\/pdf)$/i

export async function GET(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const notaId = new URL(req.url).searchParams.get('nota') || ''
  if (!notaId) return NextResponse.json({ error: 'Informe a nota' }, { status: 400 })
  const rows = await prisma.$queryRaw`
    SELECT "id","nome","url","tipo","tamanho","createdAt"
    FROM "PessoalAnexo" WHERE "userId" = ${g.userId} AND "notaId" = ${notaId}
    ORDER BY "createdAt" ASC
  `
  return NextResponse.json(serialize(rows))
}

export async function POST(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'Armazenamento de anexos não configurado (BLOB_READ_WRITE_TOKEN ausente).' }, { status: 501 })
  }
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const notaId = String(form?.get('notaId') || '')
  if (!notaId) return NextResponse.json({ error: 'Informe a nota' }, { status: 400 })
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Arquivo ausente' }, { status: 400 })
  if (file.size > MAX) return NextResponse.json({ error: 'Arquivo acima de 10 MB' }, { status: 400 })
  if (!TIPOS_OK.test(file.type)) return NextResponse.json({ error: 'Tipo não permitido (imagens ou PDF)' }, { status: 400 })

  // A nota tem que ser do próprio usuário (evita anexar em nota alheia).
  const [dono] = await prisma.$queryRaw`SELECT 1 AS ok FROM "PessoalNota" WHERE "id" = ${notaId} AND "userId" = ${g.userId}` as any[]
  if (!dono) return NextResponse.json({ error: 'Nota não encontrada' }, { status: 404 })

  const nomeSeguro = (file.name || 'anexo').replace(/[^\w.\-]+/g, '_').slice(0, 120)
  const blob = await put(`pessoal/${g.userId}/${gid()}-${nomeSeguro}`, file, {
    access: 'public', addRandomSuffix: true, contentType: file.type, token: process.env.BLOB_READ_WRITE_TOKEN,
  })
  const id = gid()
  await prisma.$executeRaw`
    INSERT INTO "PessoalAnexo" ("id","userId","notaId","nome","url","tipo","tamanho","createdAt")
    VALUES (${id}, ${g.userId}, ${notaId}, ${file.name || 'anexo'}, ${blob.url}, ${file.type}, ${file.size}, NOW())
  `
  await prisma.$executeRaw`UPDATE "PessoalNota" SET "updatedAt" = NOW() WHERE "id" = ${notaId} AND "userId" = ${g.userId}`
  return NextResponse.json({ ok: true, id, url: blob.url, nome: file.name, tipo: file.type, tamanho: file.size }, { status: 201 })
}
