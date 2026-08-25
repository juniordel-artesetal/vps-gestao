// Canais de venda com TAXAS — camada de BANCO (Master + workspace). A matemática (seed,
// regras, escolherRegra, resolverTaxaLocal, líquido…) vive em lib/canaisVendaCalc.ts (pura,
// sem prisma) e é reexportada aqui — FONTE ÚNICA usada também pela precificação no client.
//   • CatalogoCanal (GLOBAL, Master): motor de REGRAS por canal (faixa/categoria/flat), atualizadoEm.
//   • CanalVenda (por workspace): habilita gerenciado (herda o catálogo + ajuste) ou custom.
// Tudo raw SQL idempotente. Flags por workspace: moduloCanais e canaisLancaFinanceiro.
import { prisma } from '@/lib/prisma'
import { garantirColuna } from '@/lib/ddlGuard'
import {
  CATALOGO_SEED, normalizarCanal, parseRegras, escolherRegra,
  type RegraTaxa, type TaxaEfetiva, type CanalCatalogoRow, type CanalVendaRow,
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
  prontoCanal = true
}

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
      taxaFixa: (cv && cv.overrideFixa != null) ? cv.overrideFixa : regra.taxaFixa,
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
        taxaFixa: (cv && cv.overrideFixa != null) ? cv.overrideFixa : regra.taxaFixa,
        pixDias: cat.pixDias, cartaoDias: cat.cartaoDias, origem: cv ? 'gerenciado' : 'catalogo',
        atualizadoEm: cat.atualizadoEm, ajustado: !!(cv && (cv.overridePercent != null || cv.overrideFixa != null)),
      }
    }
    return { canal: slug || 'outros', nome: canalBruto || 'Outros', taxaPercent: 0, taxaFixa: 0, pixDias: 0, cartaoDias: 2, origem: 'nenhum', atualizadoEm: null }
  }
}
