// Estado do vínculo pessoal de um item de origem (ex.: um FinLancamento) — usado pelo form
// do lançamento pra pré-marcar os checkboxes ao EDITAR (senão salvar apagaria o vínculo).
// Gate: guardPessoal (ADMIN + add-on ATIVA). Escopo por userId.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const g = await guardPessoal()
  if ('erro' in g) return g.erro
  const { searchParams } = new URL(req.url)
  const origemId = (searchParams.get('origemId') || '').trim()
  const origemTipo = (searchParams.get('origemTipo') || 'financeiro').trim()
  if (!origemId) return NextResponse.json({ agenda: false, nota: false })

  const [t] = await prisma.$queryRaw`
    SELECT 1 FROM "PessoalTarefa" WHERE "userId" = ${g.userId} AND "origemTipo" = ${origemTipo} AND "origemId" = ${origemId} LIMIT 1
  ` as any[]
  const [n] = await prisma.$queryRaw`
    SELECT 1 FROM "PessoalNota" WHERE "userId" = ${g.userId} AND "origemTipo" = ${origemTipo} AND "origemId" = ${origemId} LIMIT 1
  ` as any[]
  return NextResponse.json({ agenda: !!t, nota: !!n })
}
