// SOA Edition — atualizar / excluir um preset.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ctxEstudio } from '@/lib/estudio/ctx'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const { id } = await params
  const b = await req.json().catch(() => ({}))
  await prisma.$executeRawUnsafe(
    `UPDATE "EstudioPreset" SET "nome"=COALESCE($3,"nome"), "operacoes"=COALESCE($4::jsonb,"operacoes") WHERE "id"=$1 AND "workspaceId"=$2`,
    id, c.workspaceId, typeof b.nome === 'string' && b.nome.trim() ? b.nome.trim().slice(0, 120) : null,
    Array.isArray(b.operacoes) && b.operacoes.length && b.operacoes.length <= 20 ? JSON.stringify(b.operacoes) : null)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const { id } = await params
  await prisma.$executeRawUnsafe(`DELETE FROM "EstudioPreset" WHERE "id"=$1 AND "workspaceId"=$2`, id, c.workspaceId)
  return NextResponse.json({ ok: true })
}
