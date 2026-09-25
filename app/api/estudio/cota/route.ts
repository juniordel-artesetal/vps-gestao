// SOA Edition — cota do LOGIN: "X de 300 hoje" + saldo de créditos + últimas compras.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ctxEstudio } from '@/lib/estudio/ctx'
import { statusCota } from '@/lib/estudio/cota'

export const dynamic = 'force-dynamic'

export async function GET() {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const status = await statusCota(c.workspaceId, c.userId)
  const compras = await prisma.$queryRawUnsafe(
    `SELECT "id","pacotes","imagens","valor"::float AS valor,"status","invoiceUrl","createdAt","pagaEm"
     FROM "EstudioCompra" WHERE "userId"=$1 AND "workspaceId"=$2 ORDER BY "createdAt" DESC LIMIT 10`, c.userId, c.workspaceId)
  return NextResponse.json(serialize({ ...status, compras }))
}
