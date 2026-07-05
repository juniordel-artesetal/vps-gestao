import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET público — banner/capa da loja (por slug). Servido sob demanda (fora do SELECT do catálogo).
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const [row] = await prisma.$queryRaw`
      SELECT "bannerImagem" FROM "LojaConfig" WHERE "slug" = ${slug} AND "ativo" = true LIMIT 1
    ` as { bannerImagem: string | null }[]

    const dataUrl = row?.bannerImagem
    if (!dataUrl) return new NextResponse(null, { status: 404 })

    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!m) return new NextResponse(null, { status: 404 })

    const bytes = new Uint8Array(Buffer.from(m[2], 'base64'))
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': m[1],
        'Content-Length': String(bytes.length),
        'Cache-Control': 'public, max-age=60',
      },
    })
  } catch (e) {
    console.error('[LOJA BANNER]', e)
    return new NextResponse(null, { status: 500 })
  }
}
