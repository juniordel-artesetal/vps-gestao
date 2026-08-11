// Logo da oferta, carregado sob demanda (fora da listagem). Formato salvo: data URL.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse(null, { status: 403 })

  const id = req.nextUrl.searchParams.get('id') || ''
  if (!id) return new NextResponse(null, { status: 400 })

  const rows = await prisma.$queryRaw`
    SELECT "imagem" FROM "DistribuidorPromocao" WHERE "id" = ${id} AND "ativo" = true LIMIT 1
  ` as { imagem: string | null }[]

  const dataUrl = rows[0]?.imagem
  if (!dataUrl) return new NextResponse(null, { status: 404 })
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return new NextResponse(null, { status: 404 })

  const bytes = new Uint8Array(Buffer.from(m[2], 'base64'))
  return new NextResponse(bytes, {
    status: 200,
    headers: { 'Content-Type': m[1], 'Content-Length': String(bytes.length), 'Cache-Control': 'private, max-age=300' },
  })
}
