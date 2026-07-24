// Migração ADITIVA — reengajamento: log de envio (cooldown/idempotência) + opt-out.
// IF NOT EXISTS: segura em dev e produção. Roda com o DIRECT_URL do ambiente alvo.
//   node --env-file=<env> scripts/migrar-reengajamento.mjs
import { PrismaClient } from '@prisma/client'

const url = (process.env.DIRECT_URL || process.env.DATABASE_URL || '').replace(/-pooler/, '')
const prisma = new PrismaClient({ datasources: { db: { url } } })

async function main() {
  console.log(`Banco: ${(() => { try { return new URL(url).host } catch { return '—' } })()}\n`)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ReengajamentoEnvio" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "userId" text NOT NULL,
      "enviadoEm" timestamptz NOT NULL DEFAULT now(),
      "motivo" text
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ReengajamentoEnvio_user_idx" ON "ReengajamentoEnvio" ("userId","enviadoEm")`)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ReengajamentoOptOut" (
      "userId" text PRIMARY KEY,
      "workspaceId" text,
      "criadoEm" timestamptz NOT NULL DEFAULT now()
    )`)
  const t1 = await prisma.$queryRawUnsafe(`SELECT to_regclass('public."ReengajamentoEnvio"')::text a`)
  const t2 = await prisma.$queryRawUnsafe(`SELECT to_regclass('public."ReengajamentoOptOut"')::text a`)
  console.log('✅ ReengajamentoEnvio:', t1[0].a, '· ReengajamentoOptOut:', t2[0].a)
}
main().catch(e => { console.error('❌', e.message); process.exit(1) }).finally(() => prisma.$disconnect())
