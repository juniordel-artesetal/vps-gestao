// Migração ADITIVA — campanha de migração dos 130 (Hotmart→Asaas). IF NOT EXISTS.
//   node --env-file=<env> scripts/migrar-campanha-migracao.mjs
import { PrismaClient } from '@prisma/client'
const url = (process.env.DIRECT_URL || process.env.DATABASE_URL || '').replace(/-pooler/, '')
const prisma = new PrismaClient({ datasources: { db: { url } } })

async function main() {
  console.log(`Banco: ${(() => { try { return new URL(url).host } catch { return '—' } })()}\n`)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CampanhaMigracao" (
      "id" text PRIMARY KEY,
      "email" text NOT NULL UNIQUE,
      "primeiroNome" text,
      "statusHotmartInicial" text,
      "estado" text NOT NULL DEFAULT 'pendente',
      "assinouAsaas" boolean NOT NULL DEFAULT false,
      "hotmartCancelada" boolean NOT NULL DEFAULT false,
      "dataInicio" date NOT NULL DEFAULT CURRENT_DATE,
      "ultimoEmailEm" timestamptz,
      "qtdEmailsEnviados" int NOT NULL DEFAULT 0,
      "migradaEm" timestamptz,
      "optoutEm" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CampanhaMigracao_estado_idx" ON "CampanhaMigracao" ("estado")`)
  // Controle do cupom R$20 (uso único, 1ª assinatura) — aditivo.
  await prisma.$executeRawUnsafe(`ALTER TABLE "CampanhaMigracao" ADD COLUMN IF NOT EXISTS "cupomAplicadoEm" timestamptz`)
  // Log de envio (idempotência: 1 e-mail/dia por pessoa).
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CampanhaMigracaoEnvio" (
      "id" text PRIMARY KEY,
      "email" text NOT NULL,
      "tipo" text NOT NULL,
      "dia" date NOT NULL,
      "enviadoEm" timestamptz
    )`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "CampanhaMigracaoEnvio_email_dia_key" ON "CampanhaMigracaoEnvio" ("email","dia")`)
  const [{ n }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int n FROM "CampanhaMigracao"`)
  console.log('✅ CampanhaMigracao + CampanhaMigracaoEnvio prontas · linhas na campanha:', n)
}
main().catch(e => { console.error('❌', e.message); process.exit(1) }).finally(() => prisma.$disconnect())
