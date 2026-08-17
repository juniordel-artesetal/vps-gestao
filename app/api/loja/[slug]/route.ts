import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { metodosDisponiveis } from '@/lib/pagamento'
import { ensureComboLoja } from '@/lib/precComboLoja'

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
             w."nome" AS "nome", w."instagram", w."cidade", w."estado", w."moduloLoja",
             COALESCE(w."moduloEstoque", false) AS "moduloEstoque",
             pc."pixChave", pc."linkPagamento", pc."provedor", pc."provedorAtivo",
             pc."credencial", pc."metodos"
      FROM "LojaConfig" lc
      JOIN "Workspace" w ON w."id" = lc."workspaceId"
      LEFT JOIN "LojaPagamentoConfig" pc ON pc."workspaceId" = lc."workspaceId"
      WHERE lc."slug" = ${slug}
      LIMIT 1
    ` as any[]

    // Loja inexistente, inativa ou módulo desligado → indisponível (sem vazar nada)
    if (!loja || !loja.ativo || !loja.moduloLoja) return NextResponse.json({ disponivel: false }, { status: 404 })

    const workspaceId: string = loja.workspaceId
    // Controle de estoque só vale se o MÓDULO de estoque estiver ligado. Com o módulo OFF,
    // flags "incluirEstoque" antigas nas variações NÃO podem esgotar a vitrine (bug MIMOPAPEIR).
    const controlaEstoque = !!loja.moduloEstoque
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
               (p."imagemLoja" IS NOT NULL OR p."imagem" IS NOT NULL
                 OR EXISTS (SELECT 1 FROM "LojaImagem" li WHERE li."variacaoId" = v."id" OR li."produtoId" = p."id")) AS "temImagem",
               p."lojaColecaoId", COALESCE(p."lojaOrdem", 0)::int AS "lojaOrdem",
               COALESCE(p."lojaDestaque", false) AS "lojaDestaque",
               COALESCE(v."incluirEstoque", false) AS "rastreiaEstoque",
               CASE WHEN COALESCE(v."incluirEstoque", false)
                    THEN COALESCE(s."saldoAtual", 0)::int ELSE NULL END AS "saldo"
        FROM "PrecVariacao" v
        JOIN "PrecProduto" p ON p."id" = v."produtoId"
        LEFT JOIN "EstProdutoSaldo" s ON s."variacaoId" = v."id" AND s."workspaceId" = ${workspaceId}
        WHERE p."workspaceId" = ${workspaceId}
          AND p."ativo" = true
          AND p."visivelLoja" = true
          AND v."visivelLoja" = true
          AND COALESCE(v."precoVenda", 0) > 0
        ORDER BY p."lojaOrdem", p."nome", v."tipo"
      ` as any[]
      for (const r of rows) if (!itensMap.has(r.variacaoId)) itensMap.set(r.variacaoId, { ...r, fonte: 'precificacao' })
    }

    if (usaEstoque) {
      const rows = await prisma.$queryRaw`
        SELECT v."id" AS "variacaoId", v."produtoId", p."nome" AS "produtoNome", p."descricao",
               v."tipo", v."subOpcao", v."nome" AS "variacaoNome", v."isKit",
               COALESCE(v."precoVenda", 0)::float       AS "precoVenda",
               COALESCE(v."emPromo", false)             AS "emPromo",
               COALESCE(v."precoPromocional", 0)::float AS "precoPromocional",
               (p."imagemLoja" IS NOT NULL OR s."imagem" IS NOT NULL OR p."imagem" IS NOT NULL
                 OR EXISTS (SELECT 1 FROM "LojaImagem" li WHERE li."variacaoId" = v."id" OR li."produtoId" = p."id")) AS "temImagem",
               COALESCE(s."saldoAtual", 0)::int         AS "saldo",
               true AS "rastreiaEstoque",
               p."lojaColecaoId", COALESCE(p."lojaOrdem", 0)::int AS "lojaOrdem",
               COALESCE(p."lojaDestaque", false) AS "lojaDestaque"
        FROM "PrecVariacao" v
        JOIN "PrecProduto" p ON p."id" = v."produtoId"
        LEFT JOIN "EstProdutoSaldo" s ON s."variacaoId" = v."id" AND s."workspaceId" = ${workspaceId}
        WHERE p."workspaceId" = ${workspaceId}
          AND p."ativo" = true
          AND v."incluirEstoque" = true
          AND v."visivelLoja" = true
          AND COALESCE(v."precoVenda", 0) > 0
        ORDER BY p."lojaOrdem", p."nome", v."tipo"
      ` as any[]
      for (const r of rows) if (!itensMap.has(r.variacaoId)) itensMap.set(r.variacaoId, { ...r, fonte: 'estoque' })
    }

    // Linha por variação visível (base). Fase 2 agrupa por produto quando há atributos.
    const linhas = Array.from(itensMap.values()).map((r: any) => {
      const emPromo = !!r.emPromo && Number(r.precoPromocional) > 0
      const preco = emPromo ? Number(r.precoPromocional) : Number(r.precoVenda)
      const variacaoLabel = (r.variacaoNome && String(r.variacaoNome).trim())
        || [r.tipo, r.subOpcao].filter((x: any) => x && x !== 'Padrão').join(' · ')
      return {
        tipo: 'variacao' as const,
        variacaoId: r.variacaoId,
        produtoId: r.produtoId,
        nome: r.produtoNome,
        variacao: variacaoLabel || null,
        descricao: r.descricao || null,
        preco,
        precoOriginal: emPromo ? Number(r.precoVenda) : null,
        emPromo,
        temImagem: !!r.temImagem,
        // Módulo de estoque OFF ⇒ nunca rastreia/esgota (ignora incluirEstoque stale).
        saldo: (!controlaEstoque || r.saldo === null || r.saldo === undefined) ? null : Number(r.saldo),
        rastreiaEstoque: controlaEstoque && !!r.rastreiaEstoque,
        esgotado: controlaEstoque && !!r.rastreiaEstoque && Number(r.saldo || 0) <= 0,
        fonte: r.fonte,
        colecaoId: r.lojaColecaoId || null,
        ordem: Number(r.lojaOrdem) || 0,
        destaque: !!r.lojaDestaque,
      }
    })

    // ── Fase 2: atributos por produto (agrupa em 1 card com seletor) ──────────
    const prodIds = Array.from(new Set(linhas.map(l => l.produtoId)))
    const atributos = prodIds.length ? await prisma.$queryRaw`
      SELECT "id","produtoId","nome",COALESCE("ordem",0)::int AS "ordem"
      FROM "LojaAtributo" WHERE "workspaceId" = ${workspaceId} AND "produtoId" = ANY(${prodIds}::text[])
      ORDER BY "ordem" ASC
    ` as any[] : []
    const atrPorProduto: Record<string, any[]> = {}
    for (const a of atributos) (atrPorProduto[a.produtoId] ||= []).push(a)
    const atrIds = atributos.map((a: any) => a.id)
    const opcoes = atrIds.length ? await prisma.$queryRaw`
      SELECT "id","atributoId","valor",COALESCE("ordem",0)::int AS "ordem"
      FROM "LojaAtributoOpcao" WHERE "atributoId" = ANY(${atrIds}::text[])
      ORDER BY "ordem" ASC, "valor" ASC
    ` as any[] : []
    const opcoesPorAtr: Record<string, any[]> = {}
    for (const o of opcoes) (opcoesPorAtr[o.atributoId] ||= []).push({ id: o.id, valor: o.valor, ordem: Number(o.ordem) })
    const varIds = linhas.map(l => l.variacaoId)
    const lvo = (varIds.length && atrIds.length) ? await prisma.$queryRaw`
      SELECT "variacaoId","atributoId","opcaoId" FROM "LojaVariacaoOpcao"
      WHERE "workspaceId" = ${workspaceId} AND "variacaoId" = ANY(${varIds}::text[])
    ` as any[] : []
    const comboPorVar: Record<string, Record<string, string>> = {}
    for (const m of lvo) (comboPorVar[m.variacaoId] ||= {})[m.atributoId] = m.opcaoId

    const itens: any[] = []
    const vistos = new Set<string>()
    for (const l of linhas) {
      if (vistos.has(l.variacaoId)) continue
      const atrs = atrPorProduto[l.produtoId]
      // Produto SEM atributos → card por variação (comportamento atual, compatível)
      if (!atrs || atrs.length === 0) { itens.push(l); vistos.add(l.variacaoId); continue }

      const nAtr = atrs.length
      const doProduto = linhas.filter(x => x.produtoId === l.produtoId)
      const mapeadas = doProduto.filter(x => comboPorVar[x.variacaoId] && Object.keys(comboPorVar[x.variacaoId]).length === nAtr)
      doProduto.forEach(x => vistos.add(x.variacaoId))

      // Variações visíveis SEM mapeamento completo → não somem: viram card próprio
      for (const x of doProduto.filter(x => !mapeadas.includes(x))) itens.push(x)
      if (mapeadas.length === 0) continue

      const precoAPartir = Math.min(...mapeadas.map(x => x.preco))
      const repr = mapeadas.reduce((a, b) => (a.preco <= b.preco ? a : b))
      itens.push({
        tipo: 'produto',
        produtoId: l.produtoId,
        nome: l.nome,
        descricao: l.descricao,
        precoAPartir,
        variacaoIdCapa: repr.variacaoId,
        temImagem: mapeadas.some(x => x.temImagem),
        colecaoId: l.colecaoId, ordem: l.ordem, destaque: l.destaque,
        atributos: atrs.map((a: any) => ({ id: a.id, nome: a.nome, ordem: Number(a.ordem), opcoes: opcoesPorAtr[a.id] || [] })),
        variacoes: mapeadas.map(x => ({
          variacaoId: x.variacaoId, preco: x.preco, precoOriginal: x.precoOriginal, emPromo: x.emPromo,
          saldo: x.saldo, rastreiaEstoque: x.rastreiaEstoque, esgotado: x.esgotado, temImagem: x.temImagem,
          combo: comboPorVar[x.variacaoId],
        })),
      })
    }

    // ── Combos publicados na Loja (1 card por combo, "De X por Y") ──────────────
    try {
      await ensureComboLoja()
      const combosRows = await prisma.$queryRaw`
        SELECT c."id", c."nome", c."descricao",
               c."precoNormal"::float AS "precoNormal", c."precoCombo"::float AS "precoCombo",
               c."lojaColecaoId", COALESCE(c."lojaOrdem",0)::int AS "lojaOrdem", COALESCE(c."lojaDestaque",false) AS "lojaDestaque",
               (c."imagem" IS NOT NULL) AS "temImagemPropria",
               (SELECT ci."variacaoId" FROM "PrecComboItem" ci
                 WHERE ci."comboId" = c."id" AND ci."variacaoId" IS NOT NULL
                   AND EXISTS (SELECT 1 FROM "LojaImagem" li WHERE li."variacaoId" = ci."variacaoId")
                 ORDER BY ci."id" LIMIT 1) AS "imgVariacaoId"
        FROM "PrecCombo" c
        WHERE c."workspaceId" = ${workspaceId} AND c."ativo" = true
          AND c."visivelLoja" = true AND COALESCE(c."precoCombo",0) > 0
        ORDER BY c."lojaOrdem", c."nome"
      ` as any[]
      for (const c of combosRows) {
        const promo = Number(c.precoNormal) > Number(c.precoCombo)
        itens.push({
          tipo: 'combo', comboId: c.id, nome: c.nome, descricao: c.descricao || null,
          preco: Number(c.precoCombo), precoOriginal: promo ? Number(c.precoNormal) : null, emPromo: promo,
          temImagem: !!c.imgVariacaoId || !!c.temImagemPropria, imgVariacaoId: c.imgVariacaoId || null,
          temImagemPropria: !!c.temImagemPropria,
          saldo: null, rastreiaEstoque: false, esgotado: false,
          colecaoId: c.lojaColecaoId || null, ordem: Number(c.lojaOrdem) || 0, destaque: !!c.lojaDestaque,
        })
      }
    } catch (e) { console.error('[LOJA combos]', e) }

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
        // Só a LISTA de métodos disponíveis — nunca chave/credencial.
        metodosPagamento: metodosDisponiveis(loja),
      },
      colecoes: colecoesRows.map((c: any) => ({ id: c.id, nome: c.nome, ordem: Number(c.ordem) || 0 })),
      itens,
    }))
  } catch (e) {
    console.error('[LOJA GET]', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
