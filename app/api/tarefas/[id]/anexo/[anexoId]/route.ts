import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET — serve a imagem do anexo (sob demanda), isolado por workspace
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; anexoId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse(null, { status: 401 })

  const { id, anexoId } = await params
  const [row] = await prisma.$queryRaw`
    SELECT "imagem" FROM "TarefaAnexo"
    WHERE "id"=${anexoId} AND "tarefaId"=${id} AND "workspaceId"=${session.user.workspaceId} LIMIT 1
  ` as { imagem: string | null }[]

  const dataUrl = row?.imagem
  if (!dataUrl) return new NextResponse(null, { status: 404 })
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return new NextResponse(null, { status: 404 })
  const bytes = new Uint8Array(Buffer.from(m[2], 'base64'))
  return new NextResponse(bytes, { status: 200, headers: { 'Content-Type': m[1], 'Content-Length': String(bytes.length), 'Cache-Control': 'private, max-age=60' } })
}

// DELETE — remove o anexo
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; anexoId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id, anexoId } = await params
  await prisma.$executeRaw`
    DELETE FROM "TarefaAnexo" WHERE "id"=${anexoId} AND "tarefaId"=${id} AND "workspaceId"=${session.user.workspaceId}
  `
  return NextResponse.json({ ok: true })
}
