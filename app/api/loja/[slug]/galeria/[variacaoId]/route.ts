import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET público — lista de IDs de imagem da galeria de uma variação VISÍVEL da loja.
// Efetivo: usa a galeria da variação; se vazia, a do produto. Nunca envia o base64
// (só ids) — cada imagem é servida sob demanda por /api/loja/[slug]/img/[id].
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; variacaoId: string }> }
) {
  try {
    const { slug, variacaoId } = await params

    const [loja] = await prisma.$queryRaw`
      SELECT lc."workspaceId" FROM "LojaConfig" lc
      JOIN "Workspace" w ON w."id" = lc."workspaceId"
      WHERE lc."slug" = ${slug} AND lc."ativo" = true AND w."moduloLoja" = true LIMIT 1
    ` as { workspaceId: string }[]
    if (!loja) return NextResponse.json({ imagens: [] }, { status: 404 })
    const workspaceId = loja.workspaceId

    // Confirma que a variação pertence à loja e está VISÍVEL (não vaza item oculto)
    const [v] = await prisma.$queryRaw`
      SELECT v."id", v."produtoId"
      FROM "PrecVariacao" v
      JOIN "PrecProduto" p ON p."id" = v."produtoId"
      WHERE v."id" = ${variacaoId}
        AND p."workspaceId" = ${workspaceId}
        AND p."ativo" = true
        AND v."visivelLoja" = true
        AND (p."visivelLoja" = true OR v."incluirEstoque" = true)
      LIMIT 1
    ` as { id: string; produtoId: string }[]
    if (!v) return NextResponse.json({ imagens: [] }, { status: 404 })

    let imgs = await prisma.$queryRaw`
      SELECT "id" FROM "LojaImagem" WHERE "variacaoId" = ${variacaoId}
      ORDER BY "capa" DESC, "ordem" ASC, "createdAt" ASC
    ` as { id: string }[]
    if (imgs.length === 0) {
      imgs = await prisma.$queryRaw`
        SELECT "id" FROM "LojaImagem" WHERE "produtoId" = ${v.produtoId}
        ORDER BY "capa" DESC, "ordem" ASC, "createdAt" ASC
      ` as { id: string }[]
    }

    return NextResponse.json({ imagens: imgs.map(i => i.id) })
  } catch (e) {
    console.error('[LOJA GALERIA]', e)
    return NextResponse.json({ imagens: [] }, { status: 500 })
  }
}
