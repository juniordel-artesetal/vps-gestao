// Canais de venda com TAXAS — camada de BANCO (Master + workspace). A matemática (seed,
// regras, escolherRegra, resolverTaxaLocal, líquido…) vive em lib/canaisVendaCalc.ts (pura,
// sem prisma) e é reexportada aqui — FONTE ÚNICA usada também pela precificação no client.
//   • CatalogoCanal (GLOBAL, Master): motor de REGRAS por canal (faixa/categoria/flat), atualizadoEm.
//   • CanalVenda (por workspace): habilita gerenciado (herda o catálogo + ajuste) ou custom.
// Tudo raw SQL idempotente. Flags por workspace: moduloCanais e canaisLancaFinanceiro.
import { prisma } from '@/lib/prisma'
import { garantirColuna } from '@/lib/ddlGuard'
import {
  CATALOGO_SEED, normalizarCanal, parseRegras, escolherRegra, taxaFixaDoItem, unidadesDoPedido, taxaDoPedido,
  type RegraTaxa, type TaxaEfetiva, type CanalCatalogoRow, type CanalVendaRow,
  type ProdutoDoPedido, type UnidadeVendida, type TaxaDoPedido,
} from '@/lib/canaisVendaCalc'

export * from '@/lib/canaisVendaCalc'

const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

// ─────────────────────────── SCHEMA (idempotente) ───────────────────────────
let prontoCatalogo = false, prontoCanal = false

/** Cria e SEMEIA o catálogo global (Master). ON CONFLICT DO NOTHING → não sobrescreve edições do Master. */
export async function ensureCatalogoCanal(): Promise<void> {
  if (prontoCatalogo) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CatalogoCanal" (
      "id"           TEXT PRIMARY KEY,
      "canal"        TEXT NOT NULL UNIQUE,
      "nome"         TEXT NOT NULL,
      "regras"       JSONB NOT NULL DEFAULT '[]'::jsonb,
      "categorias"   JSONB NOT NULL DEFAULT '[]'::jsonb,
      "variantes"    JSONB NOT NULL DEFAULT '[]'::jsonb,
      "pixDias"      INTEGER NOT NULL DEFAULT 0,
      "cartaoDias"   INTEGER NOT NULL DEFAULT 0,
      "estrutura"    TEXT,
      "ativo"        BOOLEAN NOT NULL DEFAULT true,
      "atualizadoEm" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "atualizadoPor" TEXT,
      "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
  for (const m of CATALOGO_SEED) {
    await prisma.$executeRaw`
      INSERT INTO "CatalogoCanal" ("id","canal","nome","regras","categorias","variantes","pixDias","cartaoDias","estrutura","ativo","atualizadoEm","createdAt")
      VALUES (${gerarId()}, ${m.canal}, ${m.nome}, ${JSON.stringify(m.regras)}::jsonb, ${JSON.stringify(m.categorias ?? [])}::jsonb,
              ${JSON.stringify(m.variantes ?? [])}::jsonb, ${m.pixDias}, ${m.cartaoDias}, ${m.estrutura}, true, NOW(), NOW())
      ON CONFLICT ("canal") DO NOTHING
    `
  }
  prontoCatalogo = true
}

/** Cria a tabela CanalVenda (workspace) + colunas de flag no Workspace. */
export async function ensureCanalVendaTable(): Promise<void> {
  if (prontoCanal) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CanalVenda" (
      "id"             TEXT PRIMARY KEY,
      "workspaceId"    TEXT NOT NULL,
      "canal"          TEXT NOT NULL,
      "nome"           TEXT NOT NULL,
      "origem"         TEXT NOT NULL DEFAULT 'gerenciado',
      "categoria"      TEXT,
      "variante"       TEXT,
      "overridePercent" NUMERIC(10,4),
      "overrideFixa"    NUMERIC(10,2),
      "taxaPercent"    NUMERIC(10,4) NOT NULL DEFAULT 0,
      "taxaFixa"       NUMERIC(10,2) NOT NULL DEFAULT 0,
      "pixDias"        INTEGER NOT NULL DEFAULT 0,
      "cartaoDias"     INTEGER NOT NULL DEFAULT 0,
      "ativo"          BOOLEAN NOT NULL DEFAULT true,
      "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "CanalVenda_ws_canal_uniq" ON "CanalVenda" ("workspaceId","canal")`)
  await garantirColuna('Workspace', 'moduloCanais', 'BOOLEAN NOT NULL DEFAULT false')
  await garantirColuna('Workspace', 'canaisLancaFinanceiro', 'BOOLEAN NOT NULL DEFAULT false')
  // Auto-lançamento das vendas de MARKETPLACE (Shopee/ML…) no financeiro. DEFAULT true
  // (preserva o comportamento atual de todo mundo); a artesã pode desligar na config.
  await garantirColuna('Workspace', 'marketplaceLancaFinanceiro', 'BOOLEAN NOT NULL DEFAULT true')
  prontoCanal = true
}

// ─────────────────────────────── FLAGS ──────────────────────────────────────
export async function flagsCanais(workspaceId: string): Promise<{ modulo: boolean; financeiro: boolean; marketplace: boolean }> {
  try {
    const [w] = await prisma.$queryRaw`SELECT "moduloCanais", "canaisLancaFinanceiro", "marketplaceLancaFinanceiro" FROM "Workspace" WHERE "id" = ${workspaceId} LIMIT 1` as { moduloCanais: boolean; canaisLancaFinanceiro: boolean; marketplaceLancaFinanceiro: boolean | null }[]
    // marketplace: default true (só false quando explicitamente desligado).
    return { modulo: w?.moduloCanais === true, financeiro: w?.canaisLancaFinanceiro === true, marketplace: w?.marketplaceLancaFinanceiro !== false }
  } catch { return { modulo: false, financeiro: false, marketplace: true } } // colunas não provisionadas → auto-lançamento marketplace ON (comportamento atual)
}
export async function moduloCanaisAtivo(workspaceId: string): Promise<boolean> {
  return (await flagsCanais(workspaceId)).modulo
}

// ─────────────────────── CATÁLOGO GLOBAL (Master) ───────────────────────────
export async function getCatalogoCanais(): Promise<CanalCatalogoRow[]> {
  await ensureCatalogoCanal()
  const rows = await prisma.$queryRaw`
    SELECT "canal","nome","regras","categorias","variantes","pixDias","cartaoDias","estrutura",
           TO_CHAR("atualizadoEm",'YYYY-MM-DD') AS "atualizadoEm", "atualizadoPor"
    FROM "CatalogoCanal" WHERE "ativo" = true ORDER BY "nome" ASC
  ` as (Omit<CanalCatalogoRow, 'regras' | 'categorias' | 'variantes'> & { regras: unknown; categorias: unknown; variantes: unknown })[]
  return rows.map(r => ({ ...r, regras: parseRegras(r.regras), categorias: parseRegras(r.categorias) as unknown as string[], variantes: parseRegras(r.variantes) as unknown as string[] }))
}

/** Master atualiza um canal do catálogo (marca atualizadoEm = agora). */
export async function atualizarCatalogoCanal(canal: string, p: { nome?: string; regras?: RegraTaxa[]; categorias?: string[]; variantes?: string[]; pixDias?: number; cartaoDias?: number; estrutura?: string; atualizadoPor?: string }): Promise<void> {
  await ensureCatalogoCanal()
  const slug = normalizarCanal(canal)
  await prisma.$executeRaw`
    UPDATE "CatalogoCanal" SET
      "nome"        = COALESCE(${p.nome ?? null}, "nome"),
      "regras"      = COALESCE(${p.regras ? JSON.stringify(p.regras) : null}::jsonb, "regras"),
      "categorias"  = COALESCE(${p.categorias ? JSON.stringify(p.categorias) : null}::jsonb, "categorias"),
      "variantes"   = COALESCE(${p.variantes ? JSON.stringify(p.variantes) : null}::jsonb, "variantes"),
      "pixDias"     = COALESCE(${p.pixDias ?? null}, "pixDias"),
      "cartaoDias"  = COALESCE(${p.cartaoDias ?? null}, "cartaoDias"),
      "estrutura"   = COALESCE(${p.estrutura ?? null}, "estrutura"),
      "atualizadoEm" = NOW(), "atualizadoPor" = ${p.atualizadoPor ?? null}
    WHERE "canal" = ${slug}
  `
}

// ─────────────────────── CANAIS DO WORKSPACE ────────────────────────────────
export async function listarCanaisVenda(workspaceId: string): Promise<CanalVendaRow[]> {
  await ensureCanalVendaTable()
  return await prisma.$queryRaw`
    SELECT "canal","nome","origem","categoria","variante",
           "overridePercent"::float AS "overridePercent", "overrideFixa"::float AS "overrideFixa",
           "taxaPercent"::float AS "taxaPercent", "taxaFixa"::float AS "taxaFixa", "pixDias", "cartaoDias"
    FROM "CanalVenda" WHERE "workspaceId" = ${workspaceId} AND "ativo" = true ORDER BY "nome" ASC
  ` as CanalVendaRow[]
}

/** Habilita/ajusta um gerenciado, ou cadastra/edita um custom. */
export async function upsertCanalVenda(workspaceId: string, c: {
  canal: string; nome?: string; origem?: 'gerenciado' | 'custom'
  categoria?: string | null; variante?: string | null
  overridePercent?: number | null; overrideFixa?: number | null
  taxaPercent?: number; taxaFixa?: number; pixDias?: number; cartaoDias?: number
}): Promise<void> {
  await ensureCanalVendaTable(); await ensureCatalogoCanal()
  const origem = c.origem === 'custom' ? 'custom' : 'gerenciado'
  const canal = origem === 'custom'
    ? (normalizarCanal(c.canal) || String(c.canal || '').trim().toLowerCase().replace(/\s+/g, '-') || gerarId())
    : normalizarCanal(c.canal)
  const nome = String(c.nome || '').trim() || canal
  const num = (v: number | null | undefined) => (v == null ? null : Math.max(0, Number(v)))
  await prisma.$executeRaw`
    INSERT INTO "CanalVenda" ("id","workspaceId","canal","nome","origem","categoria","variante","overridePercent","overrideFixa","taxaPercent","taxaFixa","pixDias","cartaoDias","ativo","createdAt","updatedAt")
    VALUES (${gerarId()}, ${workspaceId}, ${canal}, ${nome}, ${origem}, ${c.categoria ?? null}, ${c.variante ?? null},
            ${num(c.overridePercent)}, ${num(c.overrideFixa)}, ${num(c.taxaPercent) ?? 0}, ${num(c.taxaFixa) ?? 0},
            ${Math.max(0, Math.round(c.pixDias ?? 0))}, ${Math.max(0, Math.round(c.cartaoDias ?? (origem === 'custom' ? 2 : 0)))}, true, NOW(), NOW())
    ON CONFLICT ("workspaceId","canal") DO UPDATE SET
      "nome" = EXCLUDED."nome", "origem" = EXCLUDED."origem", "categoria" = EXCLUDED."categoria", "variante" = EXCLUDED."variante",
      "overridePercent" = EXCLUDED."overridePercent", "overrideFixa" = EXCLUDED."overrideFixa",
      "taxaPercent" = EXCLUDED."taxaPercent", "taxaFixa" = EXCLUDED."taxaFixa",
      "pixDias" = EXCLUDED."pixDias", "cartaoDias" = EXCLUDED."cartaoDias", "ativo" = true, "updatedAt" = NOW()
  `
}

export async function removerCanalVenda(workspaceId: string, canal: string): Promise<void> {
  await ensureCanalVendaTable()
  await prisma.$executeRaw`UPDATE "CanalVenda" SET "ativo" = false, "updatedAt" = NOW() WHERE "workspaceId" = ${workspaceId} AND "canal" = ${normalizarCanal(canal)}`
}

// ─────────────────────── RESOLVER / CÁLCULO ─────────────────────────────────

/** Taxa efetiva do canal p/ um preço (server, 1 canal): CanalVenda(custom) → gerenciado
 *  (ajuste sobre o catálogo) → catálogo puro → nenhum. `ctx.variante`/`ctx.categoria` do
 *  produto (ex.: Clássico/Premium) têm prioridade sobre o que a artesã salvou. */
export async function resolverTaxa(workspaceId: string, canal: string, ctx: { preco?: number; variante?: string | null; categoria?: string | null } = {}): Promise<TaxaEfetiva> {
  await ensureCanalVendaTable(); await ensureCatalogoCanal()
  const slug = normalizarCanal(canal)
  const preco = Math.max(0, Number(ctx.preco) || 0)

  const [cv] = await prisma.$queryRaw`
    SELECT "canal","nome","origem","categoria","variante",
           "overridePercent"::float AS "overridePercent", "overrideFixa"::float AS "overrideFixa",
           "taxaPercent"::float AS "taxaPercent", "taxaFixa"::float AS "taxaFixa", "pixDias", "cartaoDias"
    FROM "CanalVenda" WHERE "workspaceId" = ${workspaceId} AND "canal" = ${slug} AND "ativo" = true LIMIT 1
  ` as CanalVendaRow[]

  if (cv?.origem === 'custom') {
    return { canal: slug, nome: cv.nome, taxaPercent: cv.taxaPercent || 0, taxaFixa: cv.taxaFixa || 0, pixDias: cv.pixDias || 0, cartaoDias: cv.cartaoDias || 0, origem: 'custom', atualizadoEm: null }
  }

  const [cat] = await prisma.$queryRaw`
    SELECT "nome","regras","pixDias","cartaoDias", TO_CHAR("atualizadoEm",'YYYY-MM-DD') AS "atualizadoEm"
    FROM "CatalogoCanal" WHERE "canal" = ${slug} AND "ativo" = true LIMIT 1
  ` as { nome: string; regras: unknown; pixDias: number; cartaoDias: number; atualizadoEm: string | null }[]

  if (cat) {
    const variante = ctx.variante ?? cv?.variante ?? null
    const categoria = ctx.categoria ?? cv?.categoria ?? null
    const regra = escolherRegra(parseRegras(cat.regras), { preco, categoria, variante })
    const ajustado = !!(cv && (cv.overridePercent != null || cv.overrideFixa != null))
    return {
      canal: slug, nome: cv?.nome || cat.nome,
      taxaPercent: (cv && cv.overridePercent != null) ? cv.overridePercent : regra.taxaPercent,
      taxaFixa: taxaFixaDoItem(slug, preco, (cv && cv.overrideFixa != null) ? cv.overrideFixa : regra.taxaFixa),
      pixDias: cat.pixDias, cartaoDias: cat.cartaoDias,
      origem: cv ? 'gerenciado' : 'catalogo', atualizadoEm: cat.atualizadoEm, ajustado,
    }
  }

  return { canal: slug || 'outros', nome: canal || 'Outros', taxaPercent: 0, taxaFixa: 0, pixDias: 0, cartaoDias: 2, origem: 'nenhum', atualizadoEm: null }
}

/** Resolvedor EM LOTE (server): carrega canais+catálogo 1× e resolve em memória (sem N
 *  queries). Use ao resolver muitos pedidos/itens (ex.: Resultado das vendas). */
export async function criarResolvedorTaxa(workspaceId: string): Promise<(canal: string, preco: number) => TaxaEfetiva> {
  await ensureCanalVendaTable(); await ensureCatalogoCanal()
  const [canais, catalogo] = await Promise.all([listarCanaisVenda(workspaceId), getCatalogoCanais()])
  const mapCanal = new Map(canais.map(c => [c.canal, c]))
  const mapCat = new Map(catalogo.map(c => [c.canal, c]))
  return (canalBruto: string, preco: number): TaxaEfetiva => {
    const slug = normalizarCanal(canalBruto)
    const cv = mapCanal.get(slug)
    if (cv?.origem === 'custom') return { canal: slug, nome: cv.nome, taxaPercent: cv.taxaPercent || 0, taxaFixa: cv.taxaFixa || 0, pixDias: cv.pixDias || 0, cartaoDias: cv.cartaoDias || 0, origem: 'custom', atualizadoEm: null }
    const cat = mapCat.get(slug)
    if (cat) {
      const regra = escolherRegra(cat.regras, { preco, categoria: cv?.categoria, variante: cv?.variante })
      return {
        canal: slug, nome: cv?.nome || cat.nome,
        taxaPercent: (cv && cv.overridePercent != null) ? cv.overridePercent : regra.taxaPercent,
        taxaFixa: taxaFixaDoItem(slug, preco, (cv && cv.overrideFixa != null) ? cv.overrideFixa : regra.taxaFixa),
        pixDias: cat.pixDias, cartaoDias: cat.cartaoDias, origem: cv ? 'gerenciado' : 'catalogo',
        atualizadoEm: cat.atualizadoEm, ajustado: !!(cv && (cv.overridePercent != null || cv.overrideFixa != null)),
      }
    }
    return { canal: slug || 'outros', nome: canalBruto || 'Outros', taxaPercent: 0, taxaFixa: 0, pixDias: 0, cartaoDias: 2, origem: 'nenhum', atualizadoEm: null }
  }
}

// ─────────────── TAXA DO PEDIDO (por item) — servidor ───────────────

type PedidoParaTaxa = { canal: string | null; valor: number | string | null; quantidade?: number | string | null; camposExtras?: unknown }

function produtosDosExtras(camposExtras: unknown): ProdutoDoPedido[] {
  try {
    const ex = typeof camposExtras === 'string' ? JSON.parse(camposExtras) : camposExtras
    return Array.isArray((ex as { produtos?: unknown })?.produtos) ? (ex as { produtos: ProdutoDoPedido[] }).produtos : []
  } catch { return [] }
}

/**
 * Calculadora em LOTE da taxa do pedido (carrega canais, catálogo e kits 1×). Itens reais do
 * marketplace (PedidoMarketplaceItem: quantidade e preço por item da planilha/API) têm prioridade;
 * senão, os produtos do pedido (kit = 1 item por kit); senão, a quantidade do pedido.
 */
export async function criarCalculadoraTaxaPedido(workspaceId: string, orderIds: string[] = []): Promise<(p: PedidoParaTaxa & { id?: string }) => TaxaDoPedido> {
  const resolver = await criarResolvedorTaxa(workspaceId)
  const kits = await prisma.$queryRaw`
    SELECT v."id", v."qtdKit" FROM "PrecVariacao" v JOIN "PrecProduto" p ON p."id" = v."produtoId"
    WHERE p."workspaceId" = ${workspaceId} AND v."isKit" = true AND COALESCE(v."qtdKit", 0) > 1
  ` as { id: string; qtdKit: number }[]
  const mapaKit = new Map(kits.map(k => [k.id, Number(k.qtdKit) || 1]))
  const itensMkt = new Map<string, UnidadeVendida[]>()
  if (orderIds.length) {
    try {
      const rows = await prisma.$queryRaw`
        SELECT pm."orderId", i."qtd"::int AS qtd, i."precoAcordado"::float AS preco
        FROM "PedidoMarketplaceItem" i JOIN "PedidoMarketplace" pm ON pm."id" = i."pedidoMarketplaceId"
        WHERE pm."workspaceId" = ${workspaceId} AND pm."orderId" = ANY(${orderIds}::text[])
      ` as { orderId: string; qtd: number; preco: number }[]
      for (const r of rows) {
        if (!(r.preco > 0) || !(r.qtd > 0)) continue
        const l = itensMkt.get(r.orderId) ?? []; l.push({ preco: r.preco, quantidade: r.qtd }); itensMkt.set(r.orderId, l)
      }
    } catch { /* sem tabela de marketplace */ }
  }
  return (p) => {
    const valor = Number(p.valor) || 0
    const doMkt = p.id ? itensMkt.get(p.id) : undefined
    const somaMkt = doMkt?.reduce((s, u) => s + u.preco * u.quantidade, 0) ?? 0
    // Itens do marketplace, reescalados para o valor do pedido (o pedido pode ter desconto/frete).
    const unidades = doMkt && somaMkt > 0
      ? doMkt.map(u => ({ preco: u.preco * valor / somaMkt, quantidade: u.quantidade }))
      : unidadesDoPedido(valor, Number(p.quantidade) || 1, produtosDosExtras(p.camposExtras), id => mapaKit.get(id) ?? 1)
    return taxaDoPedido(unidades, preco => resolver(p.canal || '', preco))
  }
}

/** Taxa de UM pedido pelo id (lê o pedido do workspace). `bruto` sobrescreve o valor do pedido. */
export async function taxaDoPedidoPorId(workspaceId: string, orderId: string, opts: { canal?: string | null; bruto?: number } = {}): Promise<TaxaDoPedido> {
  const [o] = await prisma.$queryRaw`
    SELECT "id", "canal", COALESCE("valor", "valorTotal")::float AS valor, "quantidade", "camposExtras"
    FROM "Order" WHERE "id" = ${orderId} AND "workspaceId" = ${workspaceId} LIMIT 1
  ` as { id: string; canal: string | null; valor: number; quantidade: number | null; camposExtras: unknown }[]
  const calc = await criarCalculadoraTaxaPedido(workspaceId, [orderId])
  return calc({
    id: orderId, canal: opts.canal ?? o?.canal ?? null,
    valor: opts.bruto ?? o?.valor ?? 0, quantidade: o?.quantidade ?? 1, camposExtras: o?.camposExtras ?? null,
  })
}
