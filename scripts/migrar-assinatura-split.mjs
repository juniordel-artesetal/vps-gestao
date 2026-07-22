// ─────────────────────────────────────────────────────────────────────────────
// ETAPA 3 — snapshot do split na assinatura + defaults de comissão.
//
//   AsaasAssinatura."splitWalletId"     TEXT           carteira do parceiro
//   AsaasAssinatura."splitValor"        NUMERIC(12,2)  valor fixo repassado
//   AsaasAssinatura."splitPercentual"   NUMERIC(5,2)   % que gerou aquele valor
//
// Por que guardar isso: o split do Asaas é um TEMPLATE aplicado a cada cobrança,
// e o valor vai em fixedValue. Ele é uma FOTO do momento da criação — se o Master
// editar o percentual do parceiro depois, as cobranças futuras seguem repassando
// o valor antigo. Guardar o snapshot é o que permite ao webhook (Etapa 4) saber
// quanto o split efetivamente pagou, em vez de recalcular e discordar da realidade.
//
//   Parceiro.comissaoPercMensal DEFAULT 30
//   Parceiro.comissaoPercAnual  DEFAULT 40
//
// Só mexe no DEFAULT (parceiros novos). Nenhum parceiro existente é alterado —
// e hoje há zero cadastrados.
//
// ⚠️ ESCOPO ESTRITO — ADD COLUMN + ALTER DEFAULT. Nenhum dado alterado.
//
// USO (a ORDEM dos --env-file importa: o último vence):
//   node --env-file=.env --env-file=.env.local scripts/migrar-assinatura-split.mjs
//   node --env-file=.env --env-file=.env.local scripts/migrar-assinatura-split.mjs --apply
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const APLICAR = process.argv.includes('--apply')

const PASSOS = [
  ['AsaasAssinatura: snapshot do split', `
    ALTER TABLE "AsaasAssinatura"
      ADD COLUMN IF NOT EXISTS "splitWalletId"   TEXT,
      ADD COLUMN IF NOT EXISTS "splitValor"      NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS "splitPercentual" NUMERIC(5,2)
  `],
  ['Parceiro: default 30% mensal', `
    ALTER TABLE "Parceiro" ALTER COLUMN "comissaoPercMensal" SET DEFAULT 30
  `],
  ['Parceiro: default 40% anual', `
    ALTER TABLE "Parceiro" ALTER COLUMN "comissaoPercAnual" SET DEFAULT 40
  `],
]

async function main() {
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '?' } })()
  console.log(`\n=== Etapa 3 — split + defaults — ${APLICAR ? 'APLICANDO' : 'DRY-RUN'} ===`)
  console.log(`Banco: ${host}\n`)

  const [antes] = await prisma.$queryRawUnsafe(
    `SELECT (SELECT COUNT(*)::int FROM "Parceiro") AS parceiros,
            (SELECT COUNT(*)::int FROM "AsaasAssinatura") AS assinaturas`)
  console.log(`  antes: parceiros=${antes.parceiros} assinaturas=${antes.assinaturas}`)

  if (!APLICAR) {
    console.log()
    for (const [nome, sql] of PASSOS) console.log(`  [ ] ${nome}\n      ${sql.trim().split('\n')[0].trim()}…`)
    console.log(`\n${PASSOS.length} passos. Rode com --apply.\n`)
    return
  }

  await prisma.$transaction(async (tx) => {
    for (const [nome, sql] of PASSOS) { await tx.$executeRawUnsafe(sql); console.log(`  [x] ${nome}`) }
  })

  const [depois] = await prisma.$queryRawUnsafe(
    `SELECT (SELECT COUNT(*)::int FROM "Parceiro") AS parceiros,
            (SELECT COUNT(*)::int FROM "AsaasAssinatura") AS assinaturas`)
  console.log(`\n  depois: parceiros=${depois.parceiros} assinaturas=${depois.assinaturas}`)

  const defs = await prisma.$queryRawUnsafe(
    `SELECT column_name, column_default FROM information_schema.columns
     WHERE table_schema='public' AND table_name='Parceiro' AND column_name LIKE 'comissaoPerc%'`)
  console.log('\n  defaults de comissão:')
  for (const d of defs) console.log(`    ${d.column_name.padEnd(20)} ${d.column_default}`)

  if (antes.parceiros !== depois.parceiros || antes.assinaturas !== depois.assinaturas) {
    console.error('\n❌ Contagens mudaram — a migração deveria ser inerte.\n')
    process.exitCode = 1
    return
  }
  console.log('\n✅ Aplicada (nenhum dado alterado).\n')
}

main()
  .catch(e => { console.error('\n❌ Falhou:', e.message, '\n'); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
