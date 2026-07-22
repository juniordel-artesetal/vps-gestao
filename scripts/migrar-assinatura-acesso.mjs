// ─────────────────────────────────────────────────────────────────────────────
// ETAPA 4 — motivo da recusa do split.
//
//   AsaasAssinatura."splitErro"  TEXT
//
// Quando o Asaas recusa o split, a assinatura nasce sem ele (a artesã não pode
// ficar impedida de pagar por causa da carteira de um parceiro). Mas isso gera
// comissão a acertar na mão, e comissão invisível é comissão esquecida: o motivo
// fica gravado aqui, viaja para o accrual como causa, e aparece no Master.
//
// ⚠️ ESCOPO ESTRITO — só ADD COLUMN.
//
// USO (a ORDEM dos --env-file importa: o último vence):
//   node --env-file=.env --env-file=.env.local scripts/migrar-assinatura-acesso.mjs
//   node --env-file=.env --env-file=.env.local scripts/migrar-assinatura-acesso.mjs --apply
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const APLICAR = process.argv.includes('--apply')

async function main() {
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '?' } })()
  console.log(`\n=== Etapa 4 — splitErro — ${APLICAR ? 'APLICANDO' : 'DRY-RUN'} ===`)
  console.log(`Banco: ${host}\n`)

  if (!APLICAR) {
    console.log('  [ ] ALTER TABLE "AsaasAssinatura" ADD COLUMN IF NOT EXISTS "splitErro" TEXT')
    console.log('\n  Rode com --apply.\n'); return
  }

  const [antes] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "AsaasAssinatura"`)
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "AsaasAssinatura" ADD COLUMN IF NOT EXISTS "splitErro" TEXT`)
  console.log('  [x] AsaasAssinatura.splitErro')
  const [depois] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "AsaasAssinatura"`)
  console.log(`\n  assinaturas: ${antes.n} antes, ${depois.n} depois`)
  console.log(antes.n === depois.n ? '\n✅ Aplicada.\n' : '\n❌ Contagem mudou.\n')
  if (antes.n !== depois.n) process.exitCode = 1
}

main()
  .catch(e => { console.error('\n❌ Falhou:', e.message, '\n'); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
