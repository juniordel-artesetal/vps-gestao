import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
async function verificarMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// PUT — edita patrocinado
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params
  const b = await req.json()
  if (b.nome !== undefined && String(b.nome).trim())
    await prisma.$executeRaw`UPDATE "PesquisaPatrocinado" SET "nome"=${String(b.nome).trim()} WHERE "id"=${id}`
  if (b.anunciante !== undefined)
    await prisma.$executeRaw`UPDATE "PesquisaPatrocinado" SET "anunciante"=${b.anunciante || null} WHERE "id"=${id}`
  if (b.contato !== undefined)
    await prisma.$executeRaw`UPDATE "PesquisaPatrocinado" SET "contato"=${b.contato || null} WHERE "id"=${id}`
  if (b.dataInicio !== undefined)
    await prisma.$executeRaw`UPDATE "PesquisaPatrocinado" SET "dataInicio"=${b.dataInicio ? String(b.dataInicio) : null}::date WHERE "id"=${id}`
  if (b.dataFim !== undefined)
    await prisma.$executeRaw`UPDATE "PesquisaPatrocinado" SET "dataFim"=${b.dataFim ? String(b.dataFim) : null}::date WHERE "id"=${id}`
  if (b.link !== undefined)
    await prisma.$executeRaw`UPDATE "PesquisaPatrocinado" SET "link"=${b.link || null} WHERE "id"=${id}`
  if (b.palavrasChave !== undefined)
    await prisma.$executeRaw`UPDATE "PesquisaPatrocinado" SET "palavrasChave"=${b.palavrasChave || null} WHERE "id"=${id}`
  if (b.precoExibido !== undefined)
    await prisma.$executeRaw`UPDATE "PesquisaPatrocinado" SET "precoExibido"=${b.precoExibido || null} WHERE "id"=${id}`
  if (b.prioridade !== undefined)
    await prisma.$executeRaw`UPDATE "PesquisaPatrocinado" SET "prioridade"=${Number(b.prioridade) || 0} WHERE "id"=${id}`
  if (b.ativo !== undefined)
    await prisma.$executeRaw`UPDATE "PesquisaPatrocinado" SET "ativo"=${Boolean(b.ativo)} WHERE "id"=${id}`
  return NextResponse.json({ ok: true })
}

// DELETE — remove patrocinado
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params
  await prisma.$executeRaw`DELETE FROM "PesquisaPatrocinado" WHERE "id"=${id}`
  return NextResponse.json({ ok: true })
}
