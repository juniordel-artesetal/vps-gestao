import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET público — imagem de um item do catálogo da loja (por slug + variacaoId).
// Só serve imagem de variação que pertence à loja e está no catálogo (visível ou pronta entrega).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; variacaoId: string }> }
) {
  try {
    const { slug, variacaoId } = await params

    const [loja] = await prisma.$queryRaw`
      SELECT "workspaceId" FROM "LojaConfig" WHERE "slug" = ${slug} AND "ativo" = true LIMIT 1
    ` as { workspaceId: string }[]
    if (!loja) return new NextResponse(null, { status: 404 })

    const workspaceId = loja.workspaceId

    // Imagem = estoque (se pronta entrega) OU do produto; só se a variação está no catálogo.
    const [row] = await prisma.$queryRaw`
      SELECT COALESCE(s."imagem", p."imagem") AS "imagem"
      FROM "PrecVariacao" v
      JOIN "PrecProduto" p ON p."id" = v."produtoId"
      LEFT JOIN "EstProdutoSaldo" s ON s."variacaoId" = v."id" AND s."workspaceId" = ${workspaceId}
      WHERE v."id" = ${variacaoId}
        AND p."workspaceId" = ${workspaceId}
        AND p."ativo" = true
        AND (p."visivelLoja" = true OR v."incluirEstoque" = true)
      LIMIT 1
    ` as { imagem: string | null }[]

    const dataUrl = row?.imagem
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
    console.error('[LOJA IMG]', e)
    return new NextResponse(null, { status: 500 })
  }
}
