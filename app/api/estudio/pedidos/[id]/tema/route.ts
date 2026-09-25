// SOA Edition — "tema existente" no pedido: grava Tema + Nome + Idade no camposExtras do pedido.
// Chaves SEM "_" de propósito: a tela do pedido regrava o camposExtras inteiro ao salvar e descarta
// chaves internas (_…); estas sobrevivem e ainda aparecem para a produção.
// Só aceita tema que existe como template pronto do próprio workspace.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ctxEstudio } from '@/lib/estudio/ctx'
import { CHAVES_TEMA } from '@/lib/estudio/tema'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const { id } = await params
  const b = await req.json().catch(() => ({}))

  const [p] = await prisma.$queryRawUnsafe<{ camposExtras: string | null }[]>(
    `SELECT "camposExtras" FROM "Order" WHERE "id"=$1 AND "workspaceId"=$2`, id, c.workspaceId)
  if (!p) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
  let extras: Record<string, unknown> = {}
  try { extras = p.camposExtras ? JSON.parse(p.camposExtras) : {} } catch { extras = {} }

  if (b.remover) {
    delete extras[CHAVES_TEMA.tema]
  } else {
    const [t] = await prisma.$queryRawUnsafe<{ temaNome: string }[]>(
      `SELECT "temaNome" FROM "EstudioTemplate" WHERE "id"=$1 AND "workspaceId"=$2 AND "temaNome" IS NOT NULL`, String(b.templateId || ''), c.workspaceId)
    if (!t) return NextResponse.json({ error: 'Esse tema não tem modelo pronto.' }, { status: 400 })
    const nome = String(b.nome || '').trim().slice(0, 2000)
    if (!nome) return NextResponse.json({ error: 'Informe o nome (um por linha se forem vários).' }, { status: 400 })
    extras[CHAVES_TEMA.tema] = t.temaNome
    extras[CHAVES_TEMA.nome] = nome
    extras[CHAVES_TEMA.idade] = String(b.idade || '').trim().slice(0, 200)
  }
  await prisma.$executeRawUnsafe(
    `UPDATE "Order" SET "camposExtras"=$3, "updatedAt"=NOW() WHERE "id"=$1 AND "workspaceId"=$2`, id, c.workspaceId, JSON.stringify(extras))
  const campos: Record<string, string> = {}
  for (const k of Object.values(CHAVES_TEMA)) if (typeof extras[k] === 'string') campos[k] = extras[k] as string
  return NextResponse.json({ ok: true, campos })
}
