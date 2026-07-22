// ─────────────────────────────────────────────────────────────────────────────
// NOVO PORTÃO — o método de pagamento passa a ser a porta de entrada.
//
//   Workspace."checkoutId"        TEXT         sessão de checkout do Asaas
//   Workspace."checkoutLink"      TEXT         link hospedado (morre em 24h)
//   Workspace."checkoutCriadoEm"  TIMESTAMPTZ  base dos avisos de +1h e +23h
//   Workspace."planoEscolhido"    TEXT         'mensal' | 'anual'
//   Workspace."metodoEscolhido"   TEXT         'cartao' | 'pix'
//
// O método muda o REGIME: cartão sai do checkout com assinatura recorrente; Pix
// sai com cobrança única a cada ciclo. A régua precisa distinguir os dois, e é
// por isso que a escolha fica gravada, não inferida.
//
// Estado novo: assinaturaStatus = 'AGUARDANDO_PAGAMENTO' — a conta existe, não
// tem acesso, e não é trial nem inadimplente. Sem esse estado explícito, quem
// abandona o checkout vira conta órfã sem classificação.
//
// ⚠️ ESCOPO ESTRITO — só ADD COLUMN + índice. Nenhum dado alterado.
//
// USO: node --env-file=.env --env-file=.env.local scripts/migrar-portao-checkout.mjs --apply
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const APLICAR = process.argv.includes('--apply')

const PASSOS = [
  ['Workspace: colunas do checkout', `
    ALTER TABLE "Workspace"
      ADD COLUMN IF NOT EXISTS "checkoutId"       TEXT,
      ADD COLUMN IF NOT EXISTS "checkoutLink"     TEXT,
      ADD COLUMN IF NOT EXISTS "checkoutCriadoEm" TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS "planoEscolhido"   TEXT,
      ADD COLUMN IF NOT EXISTS "metodoEscolhido"  TEXT
  `],
  // O job varre por quem está aguardando; sem índice seria varredura completa
  // a cada hora.
  ['Workspace: índice do funil de entrada', `
    CREATE INDEX IF NOT EXISTS "Workspace_aguardando_idx"
      ON "Workspace" ("assinaturaStatus", "checkoutCriadoEm")
      WHERE "assinaturaStatus" = 'AGUARDANDO_PAGAMENTO'
  `],
]

async function main() {
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '?' } })()
  console.log(`\n=== Novo portão — ${APLICAR ? 'APLICANDO' : 'DRY-RUN'} ===`)
  console.log(`Banco: ${host}\n`)

  const [antes] = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE "ativo") ::int AS ativos FROM "Workspace"`)
  console.log(`  antes: total=${antes.total} ativos=${antes.ativos}`)

  if (!APLICAR) {
    console.log()
    for (const [n, s] of PASSOS) console.log(`  [ ] ${n}\n      ${s.trim().split('\n')[0].trim()}…`)
    console.log(`\n${PASSOS.length} passos. Rode com --apply.\n`); return
  }

  await prisma.$transaction(async (tx) => {
    for (const [n, s] of PASSOS) { await tx.$executeRawUnsafe(s); console.log(`  [x] ${n}`) }
  })

  const [depois] = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE "ativo") ::int AS ativos FROM "Workspace"`)
  console.log(`\n  depois: total=${depois.total} ativos=${depois.ativos}`)
  if (antes.total !== depois.total || antes.ativos !== depois.ativos) {
    console.error('\n❌ Contagens mudaram — a migração deveria ser inerte.\n'); process.exitCode = 1; return
  }
  console.log('\n✅ Aplicada (nenhum acesso alterado).\n')
}

main()
  .catch(e => { console.error('\n❌ Falhou:', e.message, '\n'); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
