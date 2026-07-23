// ─────────────────────────────────────────────────────────────────────────────
// ETAPA 2 — guarda o link de pagamento da cobrança.
//
//   AsaasCobranca."invoiceUrl"  TEXT
//
// É a página HOSPEDADA PELO ASAAS onde a artesã cadastra o cartão. Sem guardar,
// a tela de regularização não tem para onde mandar quem precisa pagar — e buscar
// no Asaas a cada carregamento seria uma chamada externa no caminho quente.
//
// ⚠️ ESCOPO ESTRITO — só ADD COLUMN. Nenhum dado alterado.
//
// USO (a ORDEM dos --env-file importa: o último vence):
//   node --env-file=.env --env-file=.env.local scripts/migrar-assinatura-invoice.mjs
//   node --env-file=.env --env-file=.env.local scripts/migrar-assinatura-invoice.mjs --apply
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const APLICAR = process.argv.includes('--apply')

const PASSOS = [
  ['AsaasCobranca: coluna invoiceUrl', `
    ALTER TABLE "AsaasCobranca" ADD COLUMN IF NOT EXISTS "invoiceUrl" TEXT
  `],
]

async function main() {
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '?' } })()
  console.log(`\n=== Etapa 2 — invoiceUrl — ${APLICAR ? 'APLICANDO' : 'DRY-RUN'} ===`)
  console.log(`Banco: ${host}\n`)

  if (!APLICAR) {
    for (const [nome, sql] of PASSOS) console.log(`  [ ] ${nome}\n      ${sql.trim().split('\n')[0].trim()}…`)
    console.log(`\n${PASSOS.length} passo(s). Rode com --apply.\n`)
    return
  }

  const [antes] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "AsaasCobranca"`)
  await prisma.$transaction(async (tx) => {
    for (const [nome, sql] of PASSOS) { await tx.$executeRawUnsafe(sql); console.log(`  [x] ${nome}`) }
  })
  const [depois] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "AsaasCobranca"`)
  console.log(`\n  cobranças: ${antes.n} antes, ${depois.n} depois (deve ser igual)`)
  console.log(antes.n === depois.n ? '\n✅ Aplicada.\n' : '\n❌ Contagem mudou.\n')
  if (antes.n !== depois.n) process.exitCode = 1
}

main()
  .catch(e => { console.error('\n❌ Falhou:', e.message, '\n'); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
