// ─────────────────────────────────────────────────────────────────────────────
// MIGRAÇÃO — Parceiras: auth/aprovação da parceira + cliques anônimos (LGPD).
//   node --env-file=.env --env-file=.env.local scripts/migrar-parceiras-auth.mjs [--apply]
// Aditiva (IF NOT EXISTS). ⚠️ SÓ branch Neon dev; produção é portão do Júnior.
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const APLICAR = process.argv.includes('--apply')

const PASSOS = [
  // status é a NOVA fonte da verdade de acesso da parceira (ativo continua bool).
  ['Parceiro: status', `ALTER TABLE "Parceiro" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pendente'`],
  ['Parceiro: senhaCripto', `ALTER TABLE "Parceiro" ADD COLUMN IF NOT EXISTS "senhaCripto" TEXT`],
  ['Parceiro: aprovadoEm', `ALTER TABLE "Parceiro" ADD COLUMN IF NOT EXISTS "aprovadoEm" TIMESTAMPTZ`],
  ['Parceiro: aprovadoPor', `ALTER TABLE "Parceiro" ADD COLUMN IF NOT EXISTS "aprovadoPor" TEXT`],
  ['Parceiro: CHECK do status', `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='Parceiro_status_chk') THEN
       ALTER TABLE "Parceiro" ADD CONSTRAINT "Parceiro_status_chk" CHECK ("status" IN ('pendente','aprovada','recusada'));
     END IF; END $$`],
  // ParceiroClique: contador de cliques do link, ANÔNIMO (sem PII) — LGPD.
  ['ParceiroClique: tabela', `CREATE TABLE IF NOT EXISTS "ParceiroClique" (
     "id" TEXT PRIMARY KEY,
     "parceiroId" TEXT NOT NULL,
     "via" TEXT NOT NULL DEFAULT 'link',
     "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`],
  ['ParceiroClique: índice por parceiro', `CREATE INDEX IF NOT EXISTS "ParceiroClique_parceiro_idx" ON "ParceiroClique" ("parceiroId","criadoEm")`],
]

async function main() {
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
  console.log(`\n=== Parceiras auth — ${APLICAR ? 'APLICANDO' : 'DRY-RUN'} ===\nBanco: ${host}\n`)
  if (host.includes('ep-lively-firefly')) { console.error('❌ PRODUÇÃO. Abortando.\n'); process.exit(1) }
  for (const [nome, sql] of PASSOS) { console.log(`  ${APLICAR ? '[x]' : '[ ]'} ${nome}`); if (APLICAR) await prisma.$executeRawUnsafe(sql) }
  console.log(APLICAR ? '\n  ✅ aplicado.' : `\n  ${PASSOS.length} passos. Rode com --apply.`)
  await prisma.$disconnect()
}
main().catch(e => { console.error('\n❌', e.message, '\n'); process.exit(1) }).finally(() => prisma.$disconnect())
