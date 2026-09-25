// SOA Edition — atualizar status/ZIP de um lote.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ctxEstudio, urlDoBlob } from '@/lib/estudio/ctx'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const { id } = await params
  const b = await req.json().catch(() => ({}))
  const status = ['pendente', 'processando', 'concluido', 'erro'].includes(b.status) ? b.status : null
  await prisma.$executeRawUnsafe(
    `UPDATE "EstudioJob" SET
       "status" = COALESCE($3, "status"),
       "zipUrl" = COALESCE($4, "zipUrl"),
       "concluidoEm" = CASE WHEN $3 = 'concluido' THEN NOW() ELSE "concluidoEm" END
     WHERE "id"=$1 AND "workspaceId"=$2`,
    id, c.workspaceId, status, urlDoBlob(b.zipUrl) ? b.zipUrl : null)
  return NextResponse.json({ ok: true })
}
