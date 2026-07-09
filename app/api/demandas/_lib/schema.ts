import { prisma } from '@/lib/prisma'

// Provisão idempotente das tabelas do módulo Trabalhos (freelancer).
// Este projeto não usa prisma migrate — o schema é um espelho introspectado e as
// tabelas são criadas via SQL. Aqui garantimos que as tabelas novas existam antes
// de qualquer query, de forma idempotente (CREATE TABLE IF NOT EXISTS).
//
// - DemandaPreco: tabela de "preço por peça" (produto + valor unitário), opcionalmente
//   por freelancer, cadastrada uma vez e reutilizada ao lançar um trabalho.
// - DemandaItem:  itens de uma demanda (produto + qtd + valor unit + subtotal), para
//   permitir vários produtos no mesmo trabalho.
let provisionado = false

export async function ensureDemandaTables() {
  if (provisionado) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DemandaPreco" (
      "id"            text PRIMARY KEY,
      "workspaceId"   text NOT NULL,
      "freelancerId"  text,
      "produto"       text NOT NULL,
      "valorUnitario" numeric NOT NULL DEFAULT 0,
      "ativo"         boolean NOT NULL DEFAULT true,
      "createdAt"     timestamp NOT NULL DEFAULT NOW(),
      "updatedAt"     timestamp NOT NULL DEFAULT NOW()
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "idx_demandapreco_ws" ON "DemandaPreco" ("workspaceId")
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DemandaItem" (
      "id"          text PRIMARY KEY,
      "demandaId"   text NOT NULL,
      "workspaceId" text NOT NULL,
      "produto"     text NOT NULL,
      "qtd"         int NOT NULL DEFAULT 1,
      "valorUnit"   numeric NOT NULL DEFAULT 0,
      "subtotal"    numeric NOT NULL DEFAULT 0
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "idx_demandaitem_dem" ON "DemandaItem" ("demandaId")
  `)
  provisionado = true
}
