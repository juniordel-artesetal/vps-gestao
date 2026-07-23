// ─────────────────────────────────────────────────────────────────────────────
// ETAPA 5 — registro de avisos enviados (idempotência do job diário).
//
//   AssinaturaAviso: (workspaceId, tipo, dia) ÚNICO
//
// Sem isso, rodar o cron duas vezes no mesmo dia manda o mesmo e-mail duas vezes
// — e e-mail de cobrança repetido é a forma mais rápida de irritar quem estava
// prestes a pagar. A trava é o índice, não a disciplina do código.
//
// ⚠️ ESCOPO ESTRITO — CREATE TABLE + índices.
//
// USO (a ORDEM dos --env-file importa: o último vence):
//   node --env-file=.env --env-file=.env.local scripts/migrar-assinatura-avisos.mjs
//   node --env-file=.env --env-file=.env.local scripts/migrar-assinatura-avisos.mjs --apply
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const APLICAR = process.argv.includes('--apply')

const PASSOS = [
  ['AssinaturaAviso: tabela', `
    CREATE TABLE IF NOT EXISTS "AssinaturaAviso" (
      "id"          TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "tipo"        TEXT NOT NULL,
      "dia"         DATE NOT NULL,
      "enviadoEm"   TIMESTAMPTZ,
      "erro"        TEXT,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `],
  // A trava: mesmo aviso, mesma workspace, mesmo dia — uma vez só.
  ['AssinaturaAviso: único por (workspace, tipo, dia)', `
    CREATE UNIQUE INDEX IF NOT EXISTS "AssinaturaAviso_ws_tipo_dia_key"
      ON "AssinaturaAviso" ("workspaceId", "tipo", "dia")
  `],
  ['AssinaturaAviso: varredura por dia', `
    CREATE INDEX IF NOT EXISTS "AssinaturaAviso_dia_idx"
      ON "AssinaturaAviso" ("dia" DESC, "tipo")
  `],
]

async function main() {
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '?' } })()
  console.log(`\n=== Etapa 5 — AssinaturaAviso — ${APLICAR ? 'APLICANDO' : 'DRY-RUN'} ===`)
  console.log(`Banco: ${host}\n`)

  if (!APLICAR) {
    for (const [n, s] of PASSOS) console.log(`  [ ] ${n}\n      ${s.trim().split('\n')[0].trim()}…`)
    console.log(`\n${PASSOS.length} passos. Rode com --apply.\n`); return
  }

  await prisma.$transaction(async (tx) => {
    for (const [n, s] of PASSOS) { await tx.$executeRawUnsafe(s); console.log(`  [x] ${n}`) }
  })

  // Prova que o índice morde.
  const id = 'avtest' + Date.now().toString(36)
  await prisma.$executeRawUnsafe(
    `INSERT INTO "AssinaturaAviso" ("id","workspaceId","tipo","dia") VALUES ($1,'wtest','TRIAL_D3',CURRENT_DATE)`, id)
  let duplicou = true
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "AssinaturaAviso" ("id","workspaceId","tipo","dia") VALUES ($1,'wtest','TRIAL_D3',CURRENT_DATE)`, id + 'b')
  } catch { duplicou = false }
  await prisma.$executeRawUnsafe(`DELETE FROM "AssinaturaAviso" WHERE "workspaceId" = 'wtest'`)
  console.log(`\n  ${!duplicou ? '✅' : '❌'} aviso repetido no mesmo dia é recusado pelo banco`)
  console.log(!duplicou ? '\n✅ Aplicada.\n' : '\n❌ Índice não está travando.\n')
  if (duplicou) process.exitCode = 1
}

main()
  .catch(e => { console.error('\n❌ Falhou:', e.message, '\n'); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
