// Canais de venda com TAXAS — fonte ÚNICA (antes: getTaxa()/getTaxas() hardcoded e
// duplicados em 5 telas). Duas camadas:
//   • CatalogoCanal (GLOBAL, mantido no Master): motor de REGRAS por canal — cobre
//     faixa de preço (Shopee/TikTok), categoria + Clássico/Premium (ML/Amazon) e flat.
//     Tem atualizadoEm (a "rotina de atualização") — reflete pra todos que usam.
//   • CanalVenda (por workspace): a artesã HABILITA um gerenciado (herda o catálogo,
//     com AJUSTE opcional) ou cadastra um CUSTOM (loja própria/outra plataforma).
//
// ⚠️ Taxas do catálogo são SUGESTÕES — as políticas mudam (Shopee mudou 03/2026,
//    TikTok 07/2026). Confira na fonte. A artesã pode ajustar a taxa dela.
//
// Tudo raw SQL idempotente (como lib/marketplaceSchema.ts). Flags por workspace:
//   moduloCanais (liga a feature) e canaisLancaFinanceiro (liga o lançamento de receita).
import { prisma } from '@/lib/prisma'

// Uma regra de taxa. A condição é opcional: sem condição = vale sempre (flat).
export interface RegraTaxa {
  precoAte?: number | null   // faixa de preço: aplica se preço <= precoAte (null = sem teto)
  categoria?: string | null  // categoria do anúncio (ML/Amazon)
  variante?: string | null   // 'classico' | 'premium' (ML)
  taxaPercent: number
  taxaFixa: number
  label?: string
}

export interface TaxaEfetiva {
  canal: string; nome: string
  taxaPercent: number; taxaFixa: number
  pixDias: number; cartaoDias: number
  origem: 'gerenciado' | 'custom' | 'catalogo' | 'nenhum'
  atualizadoEm: string | null
  ajustado?: boolean
}

interface ModeloCatalogo {
  canal: string; nome: string
  regras: RegraTaxa[]
  categorias?: string[]; variantes?: string[]
  pixDias: number; cartaoDias: number
  estrutura: string
}

// ─── SEED do catálogo gerenciado (números da pesquisa jul/2026 — SUGESTÕES) ───
export const CATALOGO_SEED: ModeloCatalogo[] = [
  {
    canal: 'shopee', nome: 'Shopee', pixDias: 14, cartaoDias: 14,
    estrutura: 'Comissão por faixa de preço do item + taxa fixa (frete grátis obrigatório desde 03/2026).',
    regras: [
      { precoAte: 79.99, taxaPercent: 20, taxaFixa: 4, label: 'Até R$79,99' },
      { precoAte: 99.99, taxaPercent: 14, taxaFixa: 16, label: 'R$80–99,99' },
      { precoAte: 199.99, taxaPercent: 14, taxaFixa: 20, label: 'R$100–199,99' },
      { precoAte: null, taxaPercent: 14, taxaFixa: 26, label: 'Acima de R$200' },
    ],
  },
  {
    canal: 'tiktokshop', nome: 'TikTok Shop', pixDias: 14, cartaoDias: 14,
    estrutura: 'Comissão por faixa de preço (vigente 15/07/2026). Novos vendedores costumam ter isenção nos ~60 primeiros dias.',
    regras: [
      { precoAte: 49.99, taxaPercent: 10, taxaFixa: 0, label: 'Abaixo de R$50' },
      { precoAte: null, taxaPercent: 6, taxaFixa: 6, label: 'R$50 ou mais' },
    ],
  },
  {
    canal: 'mercadolivre', nome: 'Mercado Livre', pixDias: 14, cartaoDias: 14,
    categorias: ['geral', 'roupa', 'beleza', 'casa', 'esporte'], variantes: ['classico', 'premium'],
    estrutura: 'Comissão por categoria e tipo de anúncio (Clássico/Premium ~+5pp) + custo fixo ~R$6 em itens de baixo valor. Confira no simulador oficial da sua categoria.',
    regras: [
      { categoria: 'roupa', variante: 'classico', taxaPercent: 14, taxaFixa: 6 }, { categoria: 'roupa', variante: 'premium', taxaPercent: 19, taxaFixa: 6 },
      { categoria: 'beleza', variante: 'classico', taxaPercent: 13, taxaFixa: 6 }, { categoria: 'beleza', variante: 'premium', taxaPercent: 18, taxaFixa: 6 },
      { categoria: 'casa', variante: 'classico', taxaPercent: 12, taxaFixa: 6 }, { categoria: 'casa', variante: 'premium', taxaPercent: 17, taxaFixa: 6 },
      { categoria: 'esporte', variante: 'classico', taxaPercent: 12, taxaFixa: 6 }, { categoria: 'esporte', variante: 'premium', taxaPercent: 17, taxaFixa: 6 },
      { categoria: 'geral', variante: 'classico', taxaPercent: 13, taxaFixa: 6 }, { categoria: 'geral', variante: 'premium', taxaPercent: 18, taxaFixa: 6 },
      { categoria: null, variante: 'premium', taxaPercent: 18, taxaFixa: 6 }, { categoria: null, variante: 'classico', taxaPercent: 13, taxaFixa: 6 },
    ],
  },
  {
    canal: 'amazon', nome: 'Amazon', pixDias: 14, cartaoDias: 14,
    categorias: ['geral', 'roupa', 'casa'],
    estrutura: 'Comissão por categoria (10–15%) + R$2/item (plano Individual). Plano Profissional: R$19/mês sem os R$2 (vale acima de ~10 vendas/mês).',
    regras: [
      { categoria: 'roupa', taxaPercent: 15, taxaFixa: 2 },
      { categoria: 'casa', taxaPercent: 12, taxaFixa: 2 },
      { categoria: 'geral', taxaPercent: 12, taxaFixa: 2 },
      { categoria: null, taxaPercent: 13, taxaFixa: 2 },
    ],
  },
]

export function avisoResponsabilidade(): string {
  return 'Confira as taxas com a sua plataforma — as políticas mudam. Você é responsável por manter esses números.'
}

// Normaliza rótulos/variações para o slug canônico. O pedido guarda o canal como
// rótulo ('Mercado Livre'); a precificação usa slug ('ml'). Aqui casamos.
export function normalizarCanal(s: string | null | undefined): string {
  const t = String(s || '').trim().toLowerCase()
  const mapa: Record<string, string> = {
    'ml': 'mercadolivre', 'mercado livre': 'mercadolivre', 'mercadolivre': 'mercadolivre',
    'shopee': 'shopee', 'elo7': 'elo7', 'amazon': 'amazon',
    'tiktok': 'tiktokshop', 'tiktok shop': 'tiktokshop', 'tiktokshop': 'tiktokshop',
    'magalu': 'magalu', 'magazine luiza': 'magalu',
    'site': 'site', 'site próprio': 'site', 'site proprio': 'site', 'loja': 'site', 'loja própria': 'site',
    'direta': 'direta', 'venda direta': 'direta',
    'instagram': 'instagram', 'insta': 'instagram', 'whatsapp': 'whatsapp', 'whats': 'whatsapp', 'zap': 'whatsapp',
  }
  return mapa[t] || t
}

function parseRegras(raw: unknown): RegraTaxa[] {
  if (Array.isArray(raw)) return raw as RegraTaxa[]
  if (typeof raw === 'string') { try { const a = JSON.parse(raw); return Array.isArray(a) ? a : [] } catch { return [] } }
  return []
}

/** Escolhe a regra que se aplica a (preço, categoria, variante): a mais específica e
 *  a faixa mais justa. Cai para regras genéricas quando não há match de categoria. */
export function escolherRegra(regras: RegraTaxa[], ctx: { preco?: number; categoria?: string | null; variante?: string | null }): RegraTaxa {
  const preco = Math.max(0, Number(ctx.preco) || 0)
  const cat = ctx.categoria ? String(ctx.categoria).toLowerCase() : null
  const varr = ctx.variante ? String(ctx.variante).toLowerCase() : null
  const casaFaixa = (r: RegraTaxa) => r.precoAte == null || preco <= Number(r.precoAte) + 0.005
  const casaTudo = (r: RegraTaxa) =>
    (r.categoria == null || String(r.categoria).toLowerCase() === cat) &&
    (r.variante == null || String(r.variante).toLowerCase() === varr) && casaFaixa(r)
  let cand = regras.filter(casaTudo)
  if (!cand.length) cand = regras.filter(r => r.categoria == null && r.variante == null && casaFaixa(r))
  if (!cand.length) cand = regras.slice()
  const espec = (r: RegraTaxa) => (r.categoria ? 1 : 0) + (r.variante ? 1 : 0)
  cand.sort((a, b) => espec(b) - espec(a) || (a.precoAte ?? Infinity) - (b.precoAte ?? Infinity))
  return cand[0] || { taxaPercent: 0, taxaFixa: 0 }
}

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
  await prisma.$executeRawUnsafe(`ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "moduloCanais" BOOLEAN NOT NULL DEFAULT false`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "canaisLancaFinanceiro" BOOLEAN NOT NULL DEFAULT false`)
  prontoCanal = true
}

const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

// ─────────────────────────────── FLAGS ──────────────────────────────────────

export async function flagsCanais(workspaceId: string): Promise<{ modulo: boolean; financeiro: boolean }> {
  try {
    const [w] = await prisma.$queryRaw`SELECT "moduloCanais", "canaisLancaFinanceiro" FROM "Workspace" WHERE "id" = ${workspaceId} LIMIT 1` as { moduloCanais: boolean; canaisLancaFinanceiro: boolean }[]
    return { modulo: w?.moduloCanais === true, financeiro: w?.canaisLancaFinanceiro === true }
  } catch { return { modulo: false, financeiro: false } } // colunas não provisionadas → OFF
}
export async function moduloCanaisAtivo(workspaceId: string): Promise<boolean> {
  return (await flagsCanais(workspaceId)).modulo
}

// ─────────────────────── CATÁLOGO GLOBAL (Master) ───────────────────────────

export interface CanalCatalogoRow { canal: string; nome: string; regras: RegraTaxa[]; categorias: string[]; variantes: string[]; pixDias: number; cartaoDias: number; estrutura: string | null; atualizadoEm: string | null; atualizadoPor: string | null }

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

export interface CanalVendaRow {
  canal: string; nome: string; origem: string
  categoria: string | null; variante: string | null
  overridePercent: number | null; overrideFixa: number | null
  taxaPercent: number; taxaFixa: number; pixDias: number; cartaoDias: number
}

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

/** Taxa efetiva do canal p/ um preço: CanalVenda(custom) → CanalVenda(gerenciado, com
 *  ajuste) sobre o catálogo → catálogo puro (preview) → zero. */
export async function resolverTaxa(workspaceId: string, canal: string, ctx: { preco?: number } = {}): Promise<TaxaEfetiva> {
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
    const regra = escolherRegra(parseRegras(cat.regras), { preco, categoria: cv?.categoria, variante: cv?.variante })
    const ajustado = !!(cv && (cv.overridePercent != null || cv.overrideFixa != null))
    return {
      canal: slug, nome: cv?.nome || cat.nome,
      taxaPercent: (cv && cv.overridePercent != null) ? cv.overridePercent : regra.taxaPercent,
      taxaFixa: (cv && cv.overrideFixa != null) ? cv.overrideFixa : regra.taxaFixa,
      pixDias: cat.pixDias, cartaoDias: cat.cartaoDias,
      origem: cv ? 'gerenciado' : 'catalogo', atualizadoEm: cat.atualizadoEm, ajustado,
    }
  }

  return { canal: slug || 'outros', nome: canal || 'Outros', taxaPercent: 0, taxaFixa: 0, pixDias: 0, cartaoDias: 2, origem: 'nenhum', atualizadoEm: null }
}

/** Resolvedor EM LOTE: carrega canais+catálogo 1× e resolve a taxa em memória (sem N
 *  queries). Use quando resolver muitos pedidos/itens de uma vez (ex.: Resultado das vendas). */
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
        taxaFixa: (cv && cv.overrideFixa != null) ? cv.overrideFixa : regra.taxaFixa,
        pixDias: cat.pixDias, cartaoDias: cat.cartaoDias, origem: cv ? 'gerenciado' : 'catalogo',
        atualizadoEm: cat.atualizadoEm, ajustado: !!(cv && (cv.overridePercent != null || cv.overrideFixa != null)),
      }
    }
    return { canal: slug || 'outros', nome: canalBruto || 'Outros', taxaPercent: 0, taxaFixa: 0, pixDias: 0, cartaoDias: 2, origem: 'nenhum', atualizadoEm: null }
  }
}

/** Líquido = bruto − (bruto×% + fixa). Nunca negativo. */
export function calcularLiquido(bruto: number, taxa: Pick<TaxaEfetiva, 'taxaPercent' | 'taxaFixa'>): number {
  const b = Math.max(0, Number(bruto) || 0)
  return Math.max(0, Math.round((b - b * (Number(taxa.taxaPercent) || 0) / 100 - (Number(taxa.taxaFixa) || 0)) * 100) / 100)
}

/** Quanto o canal leva em R$ (para exibir). */
export function valorTaxa(bruto: number, taxa: Pick<TaxaEfetiva, 'taxaPercent' | 'taxaFixa'>): number {
  const b = Math.max(0, Number(bruto) || 0)
  return Math.round((b * (Number(taxa.taxaPercent) || 0) / 100 + (Number(taxa.taxaFixa) || 0)) * 100) / 100
}

/** Data de recebimento (YYYY-MM-DD) = base + prazo do método (Pix D+0, cartão D+2…). */
export function dataRecebimento(base: Date, taxa: Pick<TaxaEfetiva, 'pixDias' | 'cartaoDias'>, metodo?: string | null): string {
  const dias = String(metodo || '').toLowerCase().includes('pix') ? (taxa.pixDias || 0) : (taxa.cartaoDias || 0)
  const d = new Date(base); d.setDate(d.getDate() + Math.max(0, dias | 0))
  return d.toISOString().slice(0, 10)
}
