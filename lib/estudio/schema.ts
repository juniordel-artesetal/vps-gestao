// SOA Edition — tabelas próprias (aditivas). Binário NUNCA vai para o Neon: arquivo fica no
// Vercel Blob e aqui só guardamos URL + metadados.
//
// Pré-check via to_regclass antes do CREATE: tabelas novas não são quentes como a Workspace,
// mas mantemos o padrão do projeto (nada de DDL a cada cold-start no caminho comum).
import { prisma } from '@/lib/prisma'

let schemaOk = false
export async function ensureEstudioSchema(): Promise<void> {
  if (schemaOk) return
  const [r] = await prisma.$queryRawUnsafe<{ a: boolean; t: boolean; j: boolean }[]>(`
    SELECT to_regclass('public."EstudioAsset"') IS NOT NULL AS a,
           to_regclass('public."EstudioTemplate"') IS NOT NULL AS t,
           to_regclass('public."EstudioJob"') IS NOT NULL AS j`)
  if (!r?.a) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "EstudioAsset" (
        "id" text PRIMARY KEY,
        "workspaceId" text NOT NULL,
        "tipo" text NOT NULL,                 -- molde | fonte | gerado | mockup
        "nome" text NOT NULL,
        "url" text NOT NULL,                  -- Vercel Blob
        "mime" text,
        "tamanhoBytes" bigint NOT NULL DEFAULT 0,
        "pasta" text NOT NULL DEFAULT '',
        "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "pedidoId" text,
        "meta" jsonb NOT NULL DEFAULT '{}'::jsonb,   -- largura/altura px, página em pt, família da fonte...
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EstudioAsset_ws_tipo_idx" ON "EstudioAsset" ("workspaceId","tipo")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EstudioAsset_ws_pedido_idx" ON "EstudioAsset" ("workspaceId","pedidoId")`)
  }
  if (!r?.t) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "EstudioTemplate" (
        "id" text PRIMARY KEY,
        "workspaceId" text NOT NULL,
        "nome" text NOT NULL,
        "moldeAssetId" text,
        "config" jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { caixas: [...], fundo?, ... }
        "preview" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EstudioTemplate_ws_idx" ON "EstudioTemplate" ("workspaceId")`)
  }
  if (!r?.j) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "EstudioJob" (
        "id" text PRIMARY KEY,
        "workspaceId" text NOT NULL,
        "templateId" text,
        "origem" text NOT NULL,               -- colar | xlsx | pedido
        "totalItens" int NOT NULL DEFAULT 0,
        "formato" text NOT NULL,              -- png | jpg | pdf-individual | pdf-unico | zip
        "regraNome" text,
        "status" text NOT NULL DEFAULT 'pendente',   -- pendente | processando | concluido | erro
        "zipUrl" text,
        "pedidoId" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "concluidoEm" timestamptz
      )`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EstudioJob_ws_idx" ON "EstudioJob" ("workspaceId")`)
  }
  schemaOk = true
}
