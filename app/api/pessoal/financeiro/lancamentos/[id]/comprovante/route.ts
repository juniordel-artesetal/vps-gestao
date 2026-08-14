// Serve os bytes do comprovante de um lançamento. Gated por sessão + userId:
// cada pessoa só abre o próprio comprovante (documento financeiro privado).
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal } from '@/lib/pessoal/api'
import { serveImagem } from '@/lib/pessoal/imagem'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const [row] = await prisma.$queryRaw`
    SELECT "comprovante" FROM "PessoalLancamento" WHERE "id" = ${id} AND "userId" = ${g.userId} LIMIT 1
  ` as { comprovante: string | null }[]
  return serveImagem(row?.comprovante)
}
