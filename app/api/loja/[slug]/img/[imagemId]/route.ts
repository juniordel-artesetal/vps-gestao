import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET público — serve UMA imagem da galeria por id, validando que pertence à loja
// (slug → workspace) e que o dono (produto/variação) está VISÍVEL no catálogo.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; imagemId: string }> }
) {
  try {
    const { slug, imagemId } = await params

    const [loja] = await prisma.$queryRaw`
      SELECT "workspaceId" FROM "LojaConfig" WHERE "slug" = ${slug} AND "ativo" = true LIMIT 1
    ` as { workspaceId: string }[]
    if (!loja) return new NextResponse(null, { status: 404 })
    const workspaceId = loja.workspaceId

    // Imagem do workspace cujo dono (produto direto OU produto da variação) está visível.
    const [row] = await prisma.$queryRaw`
      SELECT li."imagem"
      FROM "LojaImagem" li
      LEFT JOIN "PrecProduto"  pp ON pp."id" = li."produtoId"
      LEFT JOIN "PrecVariacao" vv ON vv."id" = li."variacaoId"
      LEFT JOIN "PrecProduto"  pv ON pv."id" = vv."produtoId"
      WHERE li."id" = ${imagemId}
        AND li."workspaceId" = ${workspaceId}
        AND (
          (li."produtoId"  IS NOT NULL AND pp."ativo" = true AND pp."visivelLoja" = true)
          OR
          (li."variacaoId" IS NOT NULL AND pv."ativo" = true AND vv."visivelLoja" = true
             AND (pv."visivelLoja" = true OR vv."incluirEstoque" = true))
        )
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
    console.error('[LOJA IMG-GALERIA]', e)
    return new NextResponse(null, { status: 500 })
  }
}
