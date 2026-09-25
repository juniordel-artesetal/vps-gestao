// SOA Edition — a artesã SUGERE uma fonte dela para o acervo de todos. Não publica nada: só marca
// para o Master avaliar (licença aberta tipo SIL OFL). Exige declarar a licença.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ctxEstudio } from '@/lib/estudio/ctx'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const { id } = await params
  const b = await req.json().catch(() => ({}))
  const licenca = String(b.licenca || '').trim().slice(0, 300)
  if (!licenca) return NextResponse.json({ error: 'Diga qual é a licença da fonte (ex.: SIL Open Font License).' }, { status: 400 })
  const n = await prisma.$executeRawUnsafe(
    `UPDATE "EstudioAsset" SET "sugeridaGlobal"=true, "meta"="meta" || jsonb_build_object('licenca',$3::text,'sugeridaPor',$4::text,'sugeridaEm',now()::text)
     WHERE "id"=$1 AND "workspaceId"=$2 AND "tipo"='fonte'`, id, c.workspaceId, licenca, c.userId)
  if (!n) return NextResponse.json({ error: 'Fonte não encontrada' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
