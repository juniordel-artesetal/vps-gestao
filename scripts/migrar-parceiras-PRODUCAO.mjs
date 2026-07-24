// ─────────────────────────────────────────────────────────────────────────────
// MIGRAÇÃO DE PRODUÇÃO — Parceiras (Tickets 02+03+04). 100% ADITIVA, IF NOT EXISTS.
// Não altera nenhum dado; só cria colunas/tabelas ausentes. Rodar UMA vez, no
// Neon de PRODUÇÃO, com DIRECT_URL (SEM -pooler).
//
//   node --env-file=<env-com-DIRECT_URL-prod> scripts/migrar-parceiras-PRODUCAO.mjs
//
// Guarda dura: SÓ roda contra ep-lively-firefly (prod). Verificado read-only em
// 23/07/2026 — AsaasAssinatura JÁ tem parceiroId+split (fora da migração).
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'

const url = (process.env.DIRECT_URL || process.env.DATABASE_URL || '').replace(/-pooler/, '')
if (!url.includes('ep-lively-firefly')) {
  console.error(`❌ Esta migração é EXCLUSIVA de produção (ep-lively-firefly). Host atual: ${(() => { try { return new URL(url).host } catch { return '—' } })()}`)
  process.exit(1)
}
const prisma = new PrismaClient({ datasources: { db: { url } } })

const PASSOS = [
  // 1) AsaasCobranca — snapshot do split do Pix (ausente em prod)
  ['AsaasCobranca.parceiroId', `ALTER TABLE "AsaasCobranca" ADD COLUMN IF NOT EXISTS "parceiroId" TEXT`],
  ['AsaasCobranca.splitWalletId', `ALTER TABLE "AsaasCobranca" ADD COLUMN IF NOT EXISTS "splitWalletId" TEXT`],
  ['AsaasCobranca.splitValor', `ALTER TABLE "AsaasCobranca" ADD COLUMN IF NOT EXISTS "splitValor" NUMERIC(12,2)`],
  ['AsaasCobranca.splitPercentual', `ALTER TABLE "AsaasCobranca" ADD COLUMN IF NOT EXISTS "splitPercentual" NUMERIC(5,2)`],
  ['AsaasCobranca.splitErro', `ALTER TABLE "AsaasCobranca" ADD COLUMN IF NOT EXISTS "splitErro" TEXT`],

  // 2) Parceiro — auth/aprovação (ausentes em prod; tabela já existe, 0 linhas)
  ['Parceiro.status', `ALTER TABLE "Parceiro" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pendente'`],
  ['Parceiro.senhaCripto', `ALTER TABLE "Parceiro" ADD COLUMN IF NOT EXISTS "senhaCripto" TEXT`],
  ['Parceiro.aprovadoEm', `ALTER TABLE "Parceiro" ADD COLUMN IF NOT EXISTS "aprovadoEm" TIMESTAMPTZ`],
  ['Parceiro.aprovadoPor', `ALTER TABLE "Parceiro" ADD COLUMN IF NOT EXISTS "aprovadoPor" TEXT`],
  ['Parceiro.status CHECK', `DO $$ BEGIN
      ALTER TABLE "Parceiro" ADD CONSTRAINT "Parceiro_status_chk" CHECK ("status" IN ('pendente','aprovada','recusada'));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`],

  // 3) ParceiroClique — cliques anônimos do link /r (ausente)
  ['ParceiroClique (tabela)', `CREATE TABLE IF NOT EXISTS "ParceiroClique" (
      "id" TEXT PRIMARY KEY,
      "parceiroId" TEXT NOT NULL,
      "via" TEXT NOT NULL DEFAULT 'link',
      "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`],
  ['ParceiroClique (índice)', `CREATE INDEX IF NOT EXISTS "ParceiroClique_parceiro_idx" ON "ParceiroClique" ("parceiroId","criadoEm")`],

  // 4) ParceiroAviso — idempotência do resumo semanal (Ticket 04, ausente)
  ['ParceiroAviso (tabela)', `CREATE TABLE IF NOT EXISTS "ParceiroAviso" (
      "id" TEXT PRIMARY KEY,
      "parceiroId" TEXT NOT NULL,
      "tipo" TEXT NOT NULL,
      "competencia" TEXT NOT NULL,
      "enviadoEm" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`],
  ['ParceiroAviso (índice único)', `CREATE UNIQUE INDEX IF NOT EXISTS "ParceiroAviso_parceiroId_tipo_competencia_key"
      ON "ParceiroAviso" ("parceiroId","tipo","competencia")`],
]

async function main() {
  console.log(`\n=== MIGRAÇÃO PARCEIRAS — PRODUÇÃO ===\nBanco: ${new URL(url).host}\n`)
  for (const [nome, sql] of PASSOS) {
    await prisma.$executeRawUnsafe(sql)
    console.log(`  ✅ ${nome}`)
  }

  // Verificação (dump) — coluna a coluna / tabela a tabela.
  console.log('\n--- verificação ---')
  const col = async (t, re) => (await prisma.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name='${t}'`)).map(c => c.column_name).filter(c => re.test(c)).sort()
  console.log('AsaasCobranca split :', (await col('AsaasCobranca', /^(parceiroId|split)/)).join(', '))
  console.log('Parceiro auth       :', (await col('Parceiro', /^(status|senhaCripto|aprovado)/)).join(', '))
  console.log('ParceiroClique      :', (await prisma.$queryRawUnsafe(`SELECT to_regclass('public."ParceiroClique"')::text r`))[0].r)
  console.log('ParceiroAviso       :', (await prisma.$queryRawUnsafe(`SELECT to_regclass('public."ParceiroAviso"')::text r`))[0].r)
  console.log('\n✅ Migração aplicada (aditiva, nenhum dado alterado).\n')
}
main().catch(e => { console.error('❌', e.message); process.exit(1) }).finally(() => prisma.$disconnect())
