// SOA Edition — abre UM template especial para editar no SOA (molde + campos). Só com a assinatura
// ativa, o termo aceito e o SOA Edition (editor/cota). Não há download do arquivo cru.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ctxEstudio } from '@/lib/estudio/ctx'
import { ACERVO_WS, especiaisLiberado, termoAceito } from '@/lib/estudio/especiais'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  if (!(await especiaisLiberado(c.workspaceId))) return NextResponse.json({ error: 'Assine os Templates Especiais para abrir este template.' }, { status: 402 })
  if (!(await termoAceito(c.userId))) return NextResponse.json({ error: 'Aceite o termo dos Templates Especiais primeiro.' }, { status: 403 })
  const { id } = await params
  const [t] = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT "id","nome","temaNome","config","moldeUrl","versao","categoria" FROM "EstudioTemplate" WHERE "id"=$1 AND "workspaceId"=$2 AND "status" IN ('publicado','substituido')`, id, ACERVO_WS)
  if (!t) return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })
  return NextResponse.json(serialize({ template: t }))
}
