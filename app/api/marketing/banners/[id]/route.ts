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
  const { titulo, imagem, link, linkexterno, ativo, ordem, tempoExibicao } = body
  await prisma.$executeRaw`
    UPDATE "MarketingBanner" SET
      "titulo"        = COALESCE(${titulo        ?? null}, "titulo"),
      "imagem"        = COALESCE(${imagem        ?? null}, "imagem"),
      "link"          = ${link ?? null},
      "linkexterno"   = COALESCE(${linkexterno   ?? null}, "linkexterno"),
      "ativo"         = COALESCE(${ativo         ?? null}, "ativo"),
      "ordem"         = COALESCE(${ordem         ?? null}, "ordem"),
      "tempoExibicao" = COALESCE(${tempoExibicao ?? null}, "tempoExibicao"),
      "updatedAt"     = NOW()
    WHERE id = ${id}
  `
  // Período: só toca quando a chave vem no corpo (permite limpar para null)
  if ('dataInicio' in body) await prisma.$executeRaw`UPDATE "MarketingBanner" SET "dataInicio" = ${body.dataInicio ? String(body.dataInicio) : null}::date WHERE id = ${id}`
  if ('dataFim' in body)    await prisma.$executeRaw`UPDATE "MarketingBanner" SET "dataFim" = ${body.dataFim ? String(body.dataFim) : null}::date WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isMaster()) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { id } = await params
  await prisma.$executeRaw`DELETE FROM "MarketingBanner" WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
