import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

// GET público — dados da loja + catálogo. Resolve o workspace SOMENTE pelo slug.
// Nunca expõe dado interno nem de outros workspaces.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params

    const [loja] = await prisma.$queryRaw`
      SELECT lc."workspaceId", lc."slug", lc."ativo",
             COALESCE(lc."logo", w."logo")               AS "logo",
             COALESCE(lc."corPrimaria", w."corPrimaria") AS "corPrimaria",
             lc."descricao", COALESCE(lc."whatsapp", w."whatsapp") AS "whatsapp",
             lc."freteTipo", lc."freteValor"::float AS "freteValor", lc."fonteCatalogo",
             lc."textoBoasVindas", (lc."bannerImagem" IS NOT NULL) AS "temBanner",
             w."nome" AS "nome", w."instagram", w."cidade", w."estado"
      FROM "LojaConfig" lc
      JOIN "Workspace" w ON w."id" = lc."workspaceId"
      WHERE lc."slug" = ${slug}
      LIMIT 1
    ` as any[]

    // Loja inexistente ou inativa → indisponível (sem vazar nada)
    if (!loja || !loja.ativo) return NextResponse.json({ disponivel: false }, { status: 404 })

    const workspaceId: string = loja.workspaceId
    const fonte: string = loja.fonteCatalogo || 'precificacao'
    const usaPrec = fonte === 'precificacao' || fonte === 'ambos'
    const usaEstoque = fonte === 'estoque' || fonte === 'ambos'

    const itensMap = new Map<string, any>()

    if (usaPrec) {
      const rows = await prisma.$queryRaw`
        SELECT v."id" AS "variacaoId", v."produtoId", p."nome" AS "produtoNome", p."descricao",
               v."tipo", v."subOpcao", v."nome" AS "variacaoNome", v."isKit",
               COALESCE(v."precoVenda", 0)::float       AS "precoVenda",
               COALESCE(v."emPromo", false)             AS "emPromo",
               COALESCE(v."precoPromocional", 0)::float AS "precoPromocional",
               (p."imagemLoja" IS NOT NULL OR p."imagem" IS NOT NULL) AS "temImagem",
               p."lojaColecaoId", COALESCE(p."lojaOrdem", 0)::int AS "lojaOrdem",
               COALESCE(p."lojaDestaque", false) AS "lojaDestaque"
        FROM "PrecVariacao" v
        JOIN "PrecProduto" p ON p."id" = v."produtoId"
        WHERE p."workspaceId" = ${workspaceId}
          AND p."ativo" = true
          AND p."visivelLoja" = true
          AND COALESCE(v."precoVenda", 0) > 0
        ORDER BY p."lojaOrdem", p."nome", v."tipo"
      ` as any[]
      for (const r of rows) if (!itensMap.has(r.variacaoId)) itensMap.set(r.variacaoId, { ...r, fonte: 'precificacao', saldo: null })
    }

    if (usaEstoque) {
      const rows = await prisma.$queryRaw`
        SELECT v."id" AS "variacaoId", v."produtoId", p."nome" AS "produtoNome", p."descricao",
               v."tipo", v."subOpcao", v."nome" AS "variacaoNome", v."isKit",
               COALESCE(v."precoVenda", 0)::float       AS "precoVenda",
               COALESCE(v."emPromo", false)             AS "emPromo",
               COALESCE(v."precoPromocional", 0)::float AS "precoPromocional",
               (p."imagemLoja" IS NOT NULL OR s."imagem" IS NOT NULL OR p."imagem" IS NOT NULL) AS "temImagem",
               COALESCE(s."saldoAtual", 0)::int         AS "saldo",
               p."lojaColecaoId", COALESCE(p."lojaOrdem", 0)::int AS "lojaOrdem",
               COALESCE(p."lojaDestaque", false) AS "lojaDestaque"
        FROM "PrecVariacao" v
        JOIN "PrecProduto" p ON p."id" = v."produtoId"
        LEFT JOIN "EstProdutoSaldo" s ON s."variacaoId" = v."id" AND s."workspaceId" = ${workspaceId}
        WHERE p."workspaceId" = ${workspaceId}
          AND p."ativo" = true
          AND v."incluirEstoque" = true
          AND COALESCE(s."saldoAtual", 0) > 0
          AND COALESCE(v."precoVenda", 0) > 0
        ORDER BY p."lojaOrdem", p."nome", v."tipo"
      ` as any[]
      for (const r of rows) if (!itensMap.has(r.variacaoId)) itensMap.set(r.variacaoId, { ...r, fonte: 'estoque' })
    }

    const itens = Array.from(itensMap.values()).map((r: any) => {
      const emPromo = !!r.emPromo && Number(r.precoPromocional) > 0
      const preco = emPromo ? Number(r.precoPromocional) : Number(r.precoVenda)
      const variacaoLabel = (r.variacaoNome && String(r.variacaoNome).trim())
        || [r.tipo, r.subOpcao].filter((x: any) => x && x !== 'Padrão').join(' · ')
      return {
        variacaoId: r.variacaoId,
        produtoId: r.produtoId,
        nome: r.produtoNome,
        variacao: variacaoLabel || null,
        descricao: r.descricao || null,
        preco,
        precoOriginal: emPromo ? Number(r.precoVenda) : null,
        emPromo,
        temImagem: !!r.temImagem,
        saldo: r.saldo ?? null,
        fonte: r.fonte,
        colecaoId: r.lojaColecaoId || null,
        ordem: Number(r.lojaOrdem) || 0,
        destaque: !!r.lojaDestaque,
      }
    })

    // Coleções ativas (para agrupar a vitrine na ordem definida)
    const colecoesRows = await prisma.$queryRaw`
      SELECT "id","nome",COALESCE("ordem",0)::int AS "ordem"
      FROM "LojaColecao"
      WHERE "workspaceId" = ${workspaceId} AND "ativo" = true
      ORDER BY "ordem" ASC, "createdAt" ASC
    ` as any[]

    return NextResponse.json(serialize({
      disponivel: true,
      loja: {
        slug: loja.slug,
        nome: loja.nome,
        logo: loja.logo || null,
        corPrimaria: loja.corPrimaria || '#f97316',
        descricao: loja.descricao || null,
        textoBoasVindas: loja.textoBoasVindas || null,
        temBanner: !!loja.temBanner,
        whatsapp: loja.whatsapp || null,
        instagram: loja.instagram || null,
        cidade: loja.cidade || null,
        estado: loja.estado || null,
        freteTipo: loja.freteTipo,
        freteValor: Number(loja.freteValor) || 0,
      },
      colecoes: colecoesRows.map((c: any) => ({ id: c.id, nome: c.nome, ordem: Number(c.ordem) || 0 })),
      itens,
    }))
  } catch (e) {
    console.error('[LOJA GET]', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
