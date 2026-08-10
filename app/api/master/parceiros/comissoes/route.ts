import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

async function verificarMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// GET — comissões (todas ou de um parceiro ?parceiroId=), com nome do parceiro.
export async function GET(req: NextRequest) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const parceiroId = searchParams.get('parceiroId')
  const status = searchParams.get('status')

  const rows = await prisma.$queryRaw`
    SELECT c."id", c."parceiroId", p."nome" AS "parceiroNome", c."workspaceId", c."competencia",
           c."base"::float AS "base", c."percentual"::float AS "percentual", c."valor"::float AS "valor",
           c."status", TO_CHAR(c."createdAt",'YYYY-MM-DD') AS "createdAt"
    FROM "ParceiroComissao" c
    JOIN "Parceiro" p ON p."id" = c."parceiroId"
    WHERE (${parceiroId}::text IS NULL OR c."parceiroId" = ${parceiroId})
      AND (${status}::text IS NULL OR c."status" = ${status})
    ORDER BY c."createdAt" DESC LIMIT 1000
  ` as any[]
  return NextResponse.json(serialize(rows))
}

// POST — marca comissão como paga (manual, até o Asaas automatizar). body: { id }
export async function POST(req: NextRequest) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await prisma.$executeRaw`UPDATE "ParceiroComissao" SET "status" = 'pago' WHERE "id" = ${String(id)}`
  return NextResponse.json({ ok: true })
}
