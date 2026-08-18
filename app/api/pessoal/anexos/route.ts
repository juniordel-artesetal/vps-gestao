// Anexos das Notas (Fase 3) — armazenados no PRÓPRIO Neon (bytea), sem storage externo.
// POST(upload multipart) + GET(?nota= lista metadados). Escopo por userId. Servidos por [id]/arquivo.
// Limite 4 MB: funções serverless da Vercel capam o corpo em ~4,5 MB.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize, gid } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

const MAX = 4 * 1024 * 1024 // 4 MB (teto do corpo de request na Vercel)
const TIPOS_OK = /^(image\/(png|jpe?g|gif|webp|svg\+xml)|application\/pdf)$/i

export async function GET(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const notaId = new URL(req.url).searchParams.get('nota') || ''
  if (!notaId) return NextResponse.json({ error: 'Informe a nota' }, { status: 400 })
  // Nunca seleciona "conteudo" aqui (só metadados) — o binário sai pela rota [id]/arquivo.
  const rows = await prisma.$queryRaw`
    SELECT "id","nome","tipo","tamanho","createdAt"
    FROM "PessoalAnexo" WHERE "userId" = ${g.userId} AND "notaId" = ${notaId}
    ORDER BY "createdAt" ASC
  `
  return NextResponse.json(serialize(rows))
}

export async function POST(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const notaId = String(form?.get('notaId') || '')
  if (!notaId) return NextResponse.json({ error: 'Informe a nota' }, { status: 400 })
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Arquivo ausente' }, { status: 400 })
  if (file.size > MAX) return NextResponse.json({ error: 'Arquivo acima de 4 MB' }, { status: 400 })
  if (!TIPOS_OK.test(file.type)) return NextResponse.json({ error: 'Tipo não permitido (imagens ou PDF)' }, { status: 400 })

  // A nota tem que ser do próprio usuário (evita anexar em nota alheia).
  const [dono] = await prisma.$queryRaw`SELECT 1 AS ok FROM "PessoalNota" WHERE "id" = ${notaId} AND "userId" = ${g.userId}` as any[]
  if (!dono) return NextResponse.json({ error: 'Nota não encontrada' }, { status: 404 })

  const bytes = Buffer.from(await file.arrayBuffer())
  const id = gid()
  await prisma.$executeRaw`
    INSERT INTO "PessoalAnexo" ("id","userId","notaId","nome","conteudo","tipo","tamanho","createdAt")
    VALUES (${id}, ${g.userId}, ${notaId}, ${file.name || 'anexo'}, ${bytes}, ${file.type}, ${file.size}, NOW())
  `
  await prisma.$executeRaw`UPDATE "PessoalNota" SET "updatedAt" = NOW() WHERE "id" = ${notaId} AND "userId" = ${g.userId}`
  // A url é a rota gated de serviço (nunca o binário direto).
  return NextResponse.json({ ok: true, id, url: `/api/pessoal/anexos/${id}/arquivo`, nome: file.name, tipo: file.type, tamanho: file.size }, { status: 201 })
}
