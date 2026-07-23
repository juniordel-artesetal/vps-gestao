// ─────────────────────────────────────────────────────────────────────────────
// BLINDAGEM DA BORDA DO 12x.
//
//   Workspace."formaEscolhida"   TEXT  'avista' | 'parcelado'
//   AsaasCobranca."anomalia"     TEXT  divergência detectada no pagamento
//
// Por quê: o checkout de 12x manda item de R$ 287,88 e o Asaas só DIVIDE. Se a
// artesã escolher 1x na página dele, paga 287,88 à vista — R$ 47,48 acima do
// preço à vista real (240,40). É borda rara, mas rara não pode ser silenciosa:
// sem guardar a forma que ela escolheu AQUI, não há como comparar com o que
// chegou de LÁ.
//
// ⚠️ ESCOPO ESTRITO — só ADD COLUMN.
//
// USO: node --env-file=.env --env-file=.env.local scripts/migrar-forma-anomalia.mjs --apply
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const APLICAR = process.argv.includes('--apply')

async function main() {
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '?' } })()
  console.log(`\n=== Blindagem do 12x — ${APLICAR ? 'APLICANDO' : 'DRY-RUN'} ===`)
  console.log(`Banco: ${host}\n`)

  if (!APLICAR) {
    console.log('  [ ] Workspace.formaEscolhida')
    console.log('  [ ] AsaasCobranca.anomalia')
    console.log('\n  Rode com --apply.\n'); return
  }

  const [antes] = await prisma.$queryRawUnsafe(
    `SELECT (SELECT COUNT(*)::int FROM "Workspace") AS w, (SELECT COUNT(*)::int FROM "AsaasCobranca") AS c`)
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "formaEscolhida" TEXT`)
    console.log('  [x] Workspace.formaEscolhida')
    await tx.$executeRawUnsafe(`ALTER TABLE "AsaasCobranca" ADD COLUMN IF NOT EXISTS "anomalia" TEXT`)
    console.log('  [x] AsaasCobranca.anomalia')
    await tx.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "AsaasCobranca_anomalia_idx" ON "AsaasCobranca" ("anomalia") WHERE "anomalia" IS NOT NULL`)
    console.log('  [x] índice parcial das anomalias')
  })
  const [depois] = await prisma.$queryRawUnsafe(
    `SELECT (SELECT COUNT(*)::int FROM "Workspace") AS w, (SELECT COUNT(*)::int FROM "AsaasCobranca") AS c`)
  console.log(`\n  workspaces: ${antes.w}→${depois.w} · cobranças: ${antes.c}→${depois.c}`)
  console.log(antes.w === depois.w && antes.c === depois.c ? '\n✅ Aplicada.\n' : '\n❌ Contagem mudou.\n')
  if (antes.w !== depois.w || antes.c !== depois.c) process.exitCode = 1
}

main().catch(e => { console.error('\n❌ Falhou:', e.message, '\n'); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
