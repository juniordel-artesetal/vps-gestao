// Serve o binário do anexo direto do Neon (bytea). GATED: sessão + userId — ninguém abre anexo alheio.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const [a] = await prisma.$queryRaw`
    SELECT "conteudo", "tipo", "nome" FROM "PessoalAnexo" WHERE "id" = ${id} AND "userId" = ${g.userId}
  ` as { conteudo: Buffer | Uint8Array; tipo: string | null; nome: string }[]
  if (!a || !a.conteudo) return NextResponse.json({ error: 'Anexo não encontrado' }, { status: 404 })
  const nome = encodeURIComponent(a.nome || 'anexo')
  // Blob é um BodyInit tipado (evita o mismatch de Buffer/Uint8Array<ArrayBufferLike>).
  const corpo = new Blob([a.conteudo as unknown as BlobPart], { type: a.tipo || 'application/octet-stream' })
  return new NextResponse(corpo, {
    headers: {
      'Content-Type': a.tipo || 'application/octet-stream',
      'Content-Disposition': `inline; filename*=UTF-8''${nome}`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
