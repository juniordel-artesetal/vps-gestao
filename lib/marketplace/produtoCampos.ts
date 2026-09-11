// Fase 2 — "Dados do Marketplace" do produto (item D) + vínculo produto↔anúncio (item C).
// camposMarketplace: JSON aditivo em PrecProduto (só aparece/valida com o módulo on).
// MarketplaceAnuncio: mapeia produtoSoaId ↔ id do anúncio no canal (idempotente, não duplica).
// Multi-canal: o mesmo modelo serve TikTok agora e ML/Shopee depois.
import { prisma } from '@/lib/prisma'

function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

export interface CamposMarketplace {
  titulo?: string
  descricao?: string
  categoriaId?: string
  categoriaNome?: string
  marca?: string
  gtin?: string
  imagens?: string[]
  pesoGramas?: number
  dimensoes?: { comprimento?: number; largura?: number; altura?: number }
  templateEnvioId?: string
  garantia?: string
  atributos?: Record<string, string>
}

let schemaOk = false
export async function ensureProdutoMarketplaceSchema(): Promise<void> {
  if (schemaOk) return
  // Coluna aditiva no produto (JSONB). PRÉ-CHECK antes do ALTER (não é a Workspace, mas mantém o padrão).
  const [c] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM information_schema.columns
    WHERE table_name = 'PrecProduto' AND column_name = 'camposMarketplace'
  `
  if (!c?.n) await prisma.$executeRawUnsafe(`ALTER TABLE "PrecProduto" ADD COLUMN IF NOT EXISTS "camposMarketplace" JSONB`)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MarketplaceAnuncio" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "produtoId" text NOT NULL,
      "canal" text NOT NULL,
      "produtoExternoId" text,
      "status" text NOT NULL DEFAULT 'nao_publicado',
      "linkAnuncio" text,
      "ultimoErro" text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "MktAnuncio_ws_prod_canal_uidx" ON "MarketplaceAnuncio" ("workspaceId","produtoId","canal")`)
  schemaOk = true
}

/**
 * Fotos da VARIAÇÃO (fonte da verdade) para o anúncio — de LojaImagem (mesmo store da vitrine),
 * por variacaoId E/OU produtoId, ordenadas capa→ordem. NÃO exige vitrine ativa (LojaImagem é só
 * o armazém de imagens, por workspace). Devolve as data URLs (o uploadImagem sobe data: pro TikTok).
 */
export async function fotosMarketplace(workspaceId: string, produtoId: string, variacaoIds: string[]): Promise<string[]> {
  const rows = await prisma.$queryRaw`
    SELECT "imagem" FROM "LojaImagem"
    WHERE "workspaceId" = ${workspaceId}
      AND ("produtoId" = ${produtoId} OR "variacaoId" = ANY(${variacaoIds}::text[]))
    ORDER BY "capa" DESC, "ordem" ASC, "createdAt" ASC
    LIMIT 9
  ` as { imagem: string }[]
  return rows.map(r => r.imagem).filter(Boolean)
}

/** Lê os campos de marketplace de um produto (do workspace). */
export async function lerCampos(workspaceId: string, produtoId: string): Promise<CamposMarketplace> {
  await ensureProdutoMarketplaceSchema()
  const [r] = await prisma.$queryRaw`
    SELECT "camposMarketplace" AS c FROM "PrecProduto" WHERE "id" = ${produtoId} AND "workspaceId" = ${workspaceId} LIMIT 1
  ` as { c: CamposMarketplace | null }[]
  return r?.c ?? {}
}

/** Salva (merge) os campos de marketplace. Aditivo — não toca o resto do produto. */
export async function salvarCampos(workspaceId: string, produtoId: string, campos: CamposMarketplace): Promise<void> {
  await ensureProdutoMarketplaceSchema()
  await prisma.$executeRaw`
    UPDATE "PrecProduto"
    SET "camposMarketplace" = COALESCE("camposMarketplace", '{}'::jsonb) || ${JSON.stringify(campos)}::jsonb,
        "updatedAt" = NOW()
    WHERE "id" = ${produtoId} AND "workspaceId" = ${workspaceId}
  `
}

// Obrigatórios genéricos para publicar. Os atributos obrigatórios ESPECÍFICOS da categoria
// vêm da API (por categoria) e são validados na publicação; aqui ficam os transversais.
export function validarCamposObrigatorios(c: CamposMarketplace): { ok: boolean; faltando: string[] } {
  const faltando: string[] = []
  if (!c.titulo?.trim()) faltando.push('Título do anúncio')
  if (!c.categoriaId) faltando.push('Categoria do canal')
  // Imagem NÃO entra aqui: a foto vem da galeria do produto (checada no publish, msg "adicione fotos").
  if (!(Number(c.pesoGramas) > 0)) faltando.push('Peso da embalagem (g)')
  const d = c.dimensoes || {}
  if (!(Number(d.comprimento) > 0 && Number(d.largura) > 0 && Number(d.altura) > 0)) faltando.push('Dimensões da embalagem (C×L×A)')
  return { ok: faltando.length === 0, faltando }
}

export interface VinculoProduto {
  produtoId: string; canal: string; produtoExternoId: string | null
  status: string; linkAnuncio: string | null; ultimoErro: string | null
}

/** Lê o vínculo (status de publicação) de um produto num canal. */
export async function lerVinculo(workspaceId: string, produtoId: string, canal: string): Promise<VinculoProduto | null> {
  await ensureProdutoMarketplaceSchema()
  const [v] = await prisma.$queryRaw`
    SELECT "produtoId","canal","produtoExternoId","status","linkAnuncio","ultimoErro"
    FROM "MarketplaceAnuncio" WHERE "workspaceId" = ${workspaceId} AND "produtoId" = ${produtoId} AND "canal" = ${canal} LIMIT 1
  ` as VinculoProduto[]
  return v ?? null
}

/** Grava/atualiza o vínculo (idempotente por ws+produto+canal — NUNCA duplica o anúncio). */
export async function salvarVinculo(
  workspaceId: string, produtoId: string, canal: string,
  dados: { produtoExternoId?: string | null; status?: string; linkAnuncio?: string | null; ultimoErro?: string | null },
): Promise<void> {
  await ensureProdutoMarketplaceSchema()
  await prisma.$executeRaw`
    INSERT INTO "MarketplaceAnuncio" ("id","workspaceId","produtoId","canal","produtoExternoId","status","linkAnuncio","ultimoErro","createdAt","updatedAt")
    VALUES (${gerarId()}, ${workspaceId}, ${produtoId}, ${canal}, ${dados.produtoExternoId ?? null}, ${dados.status ?? 'nao_publicado'}, ${dados.linkAnuncio ?? null}, ${dados.ultimoErro ?? null}, NOW(), NOW())
    ON CONFLICT ("workspaceId","produtoId","canal") DO UPDATE SET
      "produtoExternoId" = COALESCE(EXCLUDED."produtoExternoId", "MarketplaceAnuncio"."produtoExternoId"),
      "status" = EXCLUDED."status",
      "linkAnuncio" = COALESCE(EXCLUDED."linkAnuncio", "MarketplaceAnuncio"."linkAnuncio"),
      "ultimoErro" = EXCLUDED."ultimoErro",
      "updatedAt" = NOW()
  `
}
