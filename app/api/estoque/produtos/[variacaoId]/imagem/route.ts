import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — imagem do produto a pronta entrega (carregada sob demanda, fora da listagem)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ variacaoId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse(null, { status: 403 })

  const { variacaoId } = await params
  const workspaceId = session.user.workspaceId

  const rows = await prisma.$queryRaw`
    SELECT "imagem"
    FROM "EstProdutoSaldo"
    WHERE "workspaceId" = ${workspaceId}
      AND "variacaoId"  = ${variacaoId}
    LIMIT 1
  ` as { imagem: string | null }[]

  const dataUrl = rows[0]?.imagem
  if (!dataUrl) return new NextResponse(null, { status: 404 })

  // Formato salvo: data URL (data:image/jpeg;base64,...) — devolve o binário decodificado
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return new NextResponse(null, { status: 404 })

  const bytes = new Uint8Array(Buffer.from(m[2], 'base64'))
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': m[1],
      'Content-Length': String(bytes.length),
      'Cache-Control': 'private, max-age=30',
    },
  })
}
