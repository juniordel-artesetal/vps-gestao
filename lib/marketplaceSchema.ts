// Provisão idempotente das tabelas do módulo "Números do Marketplace".
// Projeto sem prisma migrate — tabelas criadas via SQL (CREATE TABLE IF NOT EXISTS).
import { prisma } from '@/lib/prisma'

let provisionado = false

export async function ensureMarketplaceTables() {
  if (provisionado) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MarketplaceConfig" (
      "id" text PRIMARY KEY, "workspaceId" text NOT NULL, "canal" text NOT NULL,
      "ativo" boolean NOT NULL DEFAULT false, "diasRepasse" int NOT NULL DEFAULT 7)
  `)
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceConfig_uniq" ON "MarketplaceConfig" ("workspaceId","canal")
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Recebivel" (
      "id" text PRIMARY KEY, "workspaceId" text NOT NULL, "orderId" text NOT NULL,
      "canal" text NOT NULL DEFAULT 'shopee',
      "valorLiquidoEstimado" numeric NOT NULL DEFAULT 0,
      "dataPrevista" date,
      "status" text NOT NULL DEFAULT 'aguardando_envio',
      "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())
  `)
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Recebivel_order_uniq" ON "Recebivel" ("workspaceId","orderId")
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Recebivel_prev_idx" ON "Recebivel" ("workspaceId","status","dataPrevista")
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MarketplaceProdutoVinculo" (
      "id" text PRIMARY KEY, "workspaceId" text NOT NULL, "canal" text NOT NULL,
      "chaveExterna" text NOT NULL, "variacaoId" text NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now())
  `)
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "MPV_uniq" ON "MarketplaceProdutoVinculo" ("workspaceId","canal","chaveExterna")
  `)
  provisionado = true
}
