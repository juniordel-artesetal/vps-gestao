// Migração ADITIVA — lista de espera do Método Mãe (MAE) na landing, enquanto a venda não abre.
//  • "MaeListaEspera": 1 linha por e-mail + plano de interesse (addon|standalone); idempotente (UNIQUE).
// Tabela nova (não toca em nenhuma existente). Aborta se o banco não for o neondb (produção).
//   node --env-file=<env> scripts/migrar-mae-lista-espera.mjs
import { PrismaClient } from '@prisma/client'

const url = (process.env.DIRECT_URL || process.env.DATABASE_URL || '').replace(/-pooler/, '')
const prisma = new PrismaClient({ datasources: { db: { url } } })

async function main() {
  const [{ db }] = await prisma.$queryRawUnsafe(`SELECT current_database() db`)
  console.log(`Banco: ${(() => { try { return new URL(url).host } catch { return '—' } })()} · ${db}\n`)
  if (db !== 'neondb') throw new Error(`Banco inesperado (${db}) — abortado`)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MaeListaEspera" (
      "id" text PRIMARY KEY,
      "email" text NOT NULL,
      "nome" text,
      "plano" text NOT NULL,
      "origem" text,
      "criadoEm" timestamptz NOT NULL DEFAULT now(),
      "avisadoEm" timestamptz,
      UNIQUE ("email", "plano")
    )`)
  const [{ n }] = await prisma.$queryRawUnsafe(`SELECT count(*)::int n FROM "MaeListaEspera"`)
  console.log(`= MaeListaEspera ok (${n} na lista)`)
}
main().catch(e => { console.error(e.message); process.exitCode = 1 }).finally(() => prisma.$disconnect())
