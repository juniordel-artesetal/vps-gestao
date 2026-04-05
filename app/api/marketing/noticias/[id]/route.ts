import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

async function isMaster(): Promise<boolean> {
  try {
    const token = (await cookies()).get('master_token')?.value
    return !!token && token === process.env.MASTER_SECRET_TOKEN
  } catch { return false }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isMaster()) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { id } = await params
  const body = await req.json()
  const { emoji, titulo, descricao, link, linkTexto, ativo, ordem } = body
  await prisma.$executeRaw`
    UPDATE "MarketingNoticia" SET
      "emoji"     = COALESCE(${emoji     ?? null}, "emoji"),
      "titulo"    = COALESCE(${titulo    ?? null}, "titulo"),
      "descricao" = COALESCE(${descricao ?? null}, "descricao"),
      "link"      = ${link ?? null},
      "linkTexto" = COALESCE(${linkTexto ?? null}, "linkTexto"),
      "ativo"     = COALESCE(${ativo     ?? null}, "ativo"),
      "ordem"     = COALESCE(${ordem     ?? null}, "ordem")
    WHERE id = ${id}
  `
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isMaster()) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { id } = await params
  await prisma.$executeRaw`DELETE FROM "MarketingNoticia" WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
