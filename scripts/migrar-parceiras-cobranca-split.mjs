// ─────────────────────────────────────────────────────────────────────────────
// MIGRAÇÃO — Parceiras: snapshot do split na AsaasCobranca (caminho Pix, que não
// tem AsaasAssinatura) + comissaoRecorrente default true.
//
//   node --env-file=.env --env-file=.env.local scripts/migrar-parceiras-cobranca-split.mjs          # DRY-RUN
//   node ... --apply
//
// Aditiva (IF NOT EXISTS). ⚠️ Rodar SÓ no branch Neon dev nesta rodada; produção
// é portão do Júnior (entra no go-live).
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const APLICAR = process.argv.includes('--apply')

const PASSOS = [
  ['AsaasCobranca: parceiroId', `ALTER TABLE "AsaasCobranca" ADD COLUMN IF NOT EXISTS "parceiroId" TEXT`],
  ['AsaasCobranca: splitWalletId', `ALTER TABLE "AsaasCobranca" ADD COLUMN IF NOT EXISTS "splitWalletId" TEXT`],
  ['AsaasCobranca: splitValor', `ALTER TABLE "AsaasCobranca" ADD COLUMN IF NOT EXISTS "splitValor" NUMERIC`],
  ['AsaasCobranca: splitPercentual', `ALTER TABLE "AsaasCobranca" ADD COLUMN IF NOT EXISTS "splitPercentual" NUMERIC`],
  ['AsaasCobranca: splitErro', `ALTER TABLE "AsaasCobranca" ADD COLUMN IF NOT EXISTS "splitErro" TEXT`],
  // Comissão é RECORRENTE (decisão): enquanto a assinante pagar, a parceira ganha.
  ['Parceiro: comissaoRecorrente default true', `ALTER TABLE "Parceiro" ALTER COLUMN "comissaoRecorrente" SET DEFAULT true`],
]

async function main() {
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
  console.log(`\n=== Parceiras — AsaasCobranca split — ${APLICAR ? 'APLICANDO' : 'DRY-RUN'} ===`)
  console.log(`Banco: ${host}\n`)
  if (host.includes('ep-lively-firefly')) { console.error('❌ PRODUÇÃO — esta rodada é só dev. Abortando.\n'); process.exit(1) }

  for (const [nome, sql] of PASSOS) {
    console.log(`  ${APLICAR ? '[x]' : '[ ]'} ${nome}`)
    if (APLICAR) await prisma.$executeRawUnsafe(sql)
  }
  if (APLICAR) {
    const cols = await prisma.$queryRawUnsafe(
      `SELECT column_name c FROM information_schema.columns WHERE table_name='AsaasCobranca' AND column_name LIKE 'split%' OR (table_name='AsaasCobranca' AND column_name='parceiroId')`)
    console.log(`\n  ✅ colunas de split na AsaasCobranca: ${cols.map(x => x.c).join(', ')}`)
  } else {
    console.log(`\n  ${PASSOS.length} passos. Rode com --apply.`)
  }
  await prisma.$disconnect()
}
main().catch(e => { console.error('\n❌', e.message, '\n'); process.exit(1) }).finally(() => prisma.$disconnect())
