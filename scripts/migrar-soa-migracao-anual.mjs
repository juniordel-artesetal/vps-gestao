// Migração ADITIVA (roda 1×, à mão — nunca DDL em runtime): tabela da troca SOA MENSAL → ANUAL (16/10/2026).
// Uma linha por pedido de troca: o checkout do anual (1ª cobrança no vencimento da mensalidade atual) e a assinatura
// mensal que é cancelada no Asaas quando o anual é confirmado. Ver lib/assinatura/migracaoAnual.ts.
//   node scripts/migrar-soa-migracao-anual.mjs   (DATABASE_URL do banco de produção; confere current_database())
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const [{ db }] = await prisma.$queryRawUnsafe('SELECT current_database() AS db')
console.log('banco:', db)
if (db !== 'neondb') { console.error('ABORTADO: não é o banco de produção (neondb)'); process.exit(1) }
await prisma.$executeRawUnsafe(`
  CREATE TABLE IF NOT EXISTS "SoaMigracaoAnual" (
    "id" text PRIMARY KEY,
    "workspaceId" text NOT NULL,
    "subMensal" text NOT NULL,
    "vencimentoMensal" date NOT NULL,
    "checkoutId" text UNIQUE,
    "checkoutLink" text,
    "parcelas" integer NOT NULL DEFAULT 1,
    "valor" numeric(10,2) NOT NULL,
    "status" text NOT NULL DEFAULT 'AGUARDANDO',
    "mensalCanceladaEm" timestamptz,
    "erro" text,
    "criadoEm" timestamptz NOT NULL DEFAULT now(),
    "concluidaEm" timestamptz
  )`)
await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SoaMigracaoAnual_ws_idx" ON "SoaMigracaoAnual" ("workspaceId")`)
await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SoaMigracaoAnual_sub_idx" ON "SoaMigracaoAnual" ("subMensal")`)
console.log('ok: SoaMigracaoAnual')
await prisma.$disconnect()
