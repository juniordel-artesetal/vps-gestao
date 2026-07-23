// ─────────────────────────────────────────────────────────────────────────────
// ETAPA 7 — rastro do cancelamento.
//
//   AsaasAssinatura."canceladaEm"      TIMESTAMPTZ
//   AsaasAssinatura."canceladaPor"     TEXT   'assinante' | 'master'
//   AsaasAssinatura."canceladaMotivo"  TEXT
//
// Cancelamento mexe em dinheiro e em acesso: precisa de quem, quando e por quê.
// Sem isso, "por que essa artesã perdeu o acesso?" vira arqueologia de log.
//
// ⚠️ ESCOPO ESTRITO — só ADD COLUMN.
//
// USO (a ORDEM dos --env-file importa: o último vence):
//   node --env-file=.env --env-file=.env.local scripts/migrar-assinatura-cancelamento.mjs --apply
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const APLICAR = process.argv.includes('--apply')

async function main() {
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '?' } })()
  console.log(`\n=== Etapa 7 — cancelamento — ${APLICAR ? 'APLICANDO' : 'DRY-RUN'} ===`)
  console.log(`Banco: ${host}\n`)

  if (!APLICAR) {
    console.log('  [ ] ALTER TABLE "AsaasAssinatura" ADD canceladaEm/canceladaPor/canceladaMotivo')
    console.log('\n  Rode com --apply.\n'); return
  }

  const [antes] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "AsaasAssinatura"`)
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "AsaasAssinatura"
      ADD COLUMN IF NOT EXISTS "canceladaEm"     TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS "canceladaPor"    TEXT,
      ADD COLUMN IF NOT EXISTS "canceladaMotivo" TEXT
  `)
  console.log('  [x] colunas de cancelamento')
  const [depois] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "AsaasAssinatura"`)
  console.log(`\n  assinaturas: ${antes.n} antes, ${depois.n} depois`)
  console.log(antes.n === depois.n ? '\n✅ Aplicada.\n' : '\n❌ Contagem mudou.\n')
  if (antes.n !== depois.n) process.exitCode = 1
}

main()
  .catch(e => { console.error('\n❌ Falhou:', e.message, '\n'); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
