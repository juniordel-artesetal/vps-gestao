import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { baseUrlDeHeaders } from '@/lib/baseUrl'

export const dynamic = 'force-dynamic'

// Imagem do card de preview (Open Graph) do link do orçamento.
// O logo do ateliê fica no banco como data URI (base64) — que NÃO renderiza no
// WhatsApp/redes. Aqui decodificamos pra bytes e servimos como imagem HTTP de verdade.
// Sem logo (ou logo inválido) → cai no logo padrão do SOA.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  try {
    const [row] = await prisma.$queryRaw`
      SELECT w."logo" AS "logo"
      FROM "Orcamento" o
      JOIN "Workspace" w ON w."id" = o."workspaceId"
      WHERE o."tokenAprovacao" = ${token}
    ` as any[]

    const logo: string | null = row?.logo || null
    const m = logo ? /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(logo) : null
    if (m) {
      const mime = m[1]
      const buf = Buffer.from(m[2], 'base64')
      if (buf.length > 0) {
        return new NextResponse(new Uint8Array(buf), {
          headers: {
            'Content-Type': mime,
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          },
        })
      }
    }
    if (logo && /^https?:\/\//i.test(logo)) return NextResponse.redirect(logo)
  } catch (e) {
    console.error('[ORCAMENTO-OG]', e)
  }
  return NextResponse.redirect(`${baseUrlDeHeaders(req.headers)}/logo.png`)
}
