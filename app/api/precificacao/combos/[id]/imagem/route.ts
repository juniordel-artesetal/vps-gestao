// Imagem própria do combo (admin) — carregada sob demanda, fora da listagem. Formato: data URL.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse(null, { status: 403 })
  const { id } = await params
  const rows = await prisma.$queryRaw`
    SELECT "imagem" FROM "PrecCombo" WHERE "id" = ${id} AND "workspaceId" = ${session.user.workspaceId} LIMIT 1
  ` as { imagem: string | null }[]

  const dataUrl = rows[0]?.imagem
  if (!dataUrl) return new NextResponse(null, { status: 404 })
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return new NextResponse(null, { status: 404 })
  const bytes = new Uint8Array(Buffer.from(m[2], 'base64'))
  return new NextResponse(bytes, { status: 200, headers: { 'Content-Type': m[1], 'Content-Length': String(bytes.length), 'Cache-Control': 'private, max-age=60' } })
}
