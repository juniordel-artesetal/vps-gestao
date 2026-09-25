// SOA Edition — Templates Especiais (acervo curado da Naty). Fica FORA do ctxEstudio: quem não assina vê
// as miniaturas com cadeado e o botão de assinar. GET → acervo publicado + status; POST → aceitar o termo.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ACERVO_WS, TERMO_TEXTO, TERMO_VERSAO, aceitarTermo, statusEspeciais, termoAceito } from '@/lib/estudio/especiais'
import { estudioLiberado } from '@/lib/estudio/modulo'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const status = await statusEspeciais(session.user.workspaceId)
  const itens = await prisma.$queryRawUnsafe(
    `SELECT "id","nome","categoria","preview","versao","publicadoEm", ("publicadoEm" > now() - interval '7 days') AS "novo"
     FROM "EstudioTemplate" WHERE "workspaceId"=$1 AND "status"='publicado' ORDER BY "publicadoEm" DESC LIMIT 1000`, ACERVO_WS)
  return NextResponse.json(serialize({
    ...status, itens, termo: { texto: TERMO_TEXTO, versao: TERMO_VERSAO, aceito: await termoAceito(session.user.id) },
    editor: await estudioLiberado(session.user.workspaceId),
  }))
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  if (b.acao !== 'aceitar-termo' || b.versao !== TERMO_VERSAO) return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  await aceitarTermo(session.user.workspaceId, session.user.id)
  return NextResponse.json({ ok: true })
}
