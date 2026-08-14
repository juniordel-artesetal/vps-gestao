// Serve os bytes da imagem de uma tarefa. Gated por sessão + userId.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal } from '@/lib/pessoal/api'
import { serveImagem } from '@/lib/pessoal/imagem'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const [row] = await prisma.$queryRaw`
    SELECT "imagem" FROM "PessoalTarefa" WHERE "id" = ${id} AND "userId" = ${g.userId} LIMIT 1
  ` as { imagem: string | null }[]
  return serveImagem(row?.imagem)
}
