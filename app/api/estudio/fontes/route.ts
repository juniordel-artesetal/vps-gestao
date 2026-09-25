// SOA Edition — fontes disponíveis para ESTE workspace.
//   • minhas: as que o próprio ateliê subiu — PRIVADAS (nunca aparecem para outro workspace).
//   • acervo: só as aprovadas pelo Master (aprovadaGlobal = licença aberta conferida). Nunca
//     automático: sugerir não publica; só a aprovação consciente do Master publica.
// As 8 nativas (OFL, next/font) ficam no cliente e não passam por aqui.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ctxEstudio } from '@/lib/estudio/ctx'

export const dynamic = 'force-dynamic'

export async function GET() {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const minhas = await prisma.$queryRawUnsafe(
    `SELECT "id","nome","url","meta"->>'familia' AS familia,"sugeridaGlobal","aprovadaGlobal"
     FROM "EstudioAsset" WHERE "workspaceId"=$1 AND "tipo"='fonte' ORDER BY "createdAt" DESC LIMIT 200`, c.workspaceId)
  const acervo = await prisma.$queryRawUnsafe(
    `SELECT "id","nome","url","meta"->>'familia' AS familia, "meta"->>'licenca' AS licenca
     FROM "EstudioAsset" WHERE "tipo"='fonte' AND "aprovadaGlobal"=true AND "workspaceId"<>$1 ORDER BY "nome" LIMIT 200`, c.workspaceId)
  return NextResponse.json(serialize({ minhas, acervo }))
}
