import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET público — imagem PRÓPRIA de um combo publicado na loja (por slug + comboId).
// Só serve se o combo pertence à loja, está ativo e visível na vitrine.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; comboId: string }> }
) {
  try {
    const { slug, comboId } = await params

    const [loja] = await prisma.$queryRaw`
      SELECT "workspaceId" FROM "LojaConfig" WHERE "slug" = ${slug} AND "ativo" = true LIMIT 1
    ` as { workspaceId: string }[]
    if (!loja) return new NextResponse(null, { status: 404 })

    const [row] = await prisma.$queryRaw`
      SELECT "imagem" FROM "PrecCombo"
      WHERE "id" = ${comboId} AND "workspaceId" = ${loja.workspaceId}
        AND "ativo" = true AND "visivelLoja" = true
      LIMIT 1
    ` as { imagem: string | null }[]

    const dataUrl = row?.imagem
    if (!dataUrl) return new NextResponse(null, { status: 404 })
    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!m) return new NextResponse(null, { status: 404 })

    const bytes = new Uint8Array(Buffer.from(m[2], 'base64'))
    return new NextResponse(bytes, {
      status: 200,
      headers: { 'Content-Type': m[1], 'Content-Length': String(bytes.length), 'Cache-Control': 'public, max-age=60' },
    })
  } catch (e) {
    console.error('[LOJA COMBO IMG]', e)
    return new NextResponse(null, { status: 500 })
  }
}
