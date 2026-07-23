// ─────────────────────────────────────────────────────────────────────────────
// Fundação do motor de pagamento ASAAS — DDL (idempotente, re-executável).
//
//   (1) "AsaasConfig": colunas novas (token do webhook, wallet da plataforma,
//       kill-switch "ativo" default FALSE, resultado do último teste de conexão).
//   (2) "AsaasEvento":     idempotência do webhook (eventoId ÚNICO).
//   (3) "AsaasCliente":    workspace ↔ customer do Asaas.
//   (4) "AsaasAssinatura": assinatura do SOA no Asaas (SÓ NOVOS cadastros —
//                          a base atual continua na Hotmart, ver HotmartAssinatura).
//   (5) "AsaasCobranca":   cobranças geradas (avulsa ou da assinatura).
//
// ⚠️ ESCOPO ESTRITO — só CREATE/ADD. NÃO altera dado existente, NÃO toca
//    Hotmart*, Workspace, Parceiro nem ParceiroComissao.
//
// USO (a ORDEM dos --env-file importa: o último vence):
//   node --env-file=.env --env-file=.env.local scripts/migrar-asaas-fundacao.mjs
//   node --env-file=.env --env-file=.env.local scripts/migrar-asaas-fundacao.mjs --apply
//
// .env      → LOGISTICA_TOKEN_KEY (cripto) e demais segredos, sem duplicação
// .env.local → DATABASE_URL/DIRECT_URL do branch Neon de DEV + ASAAS_API_KEY sandbox
//
// ⚠️ Sem o .env.local, DATABASE_URL/DIRECT_URL caem em PRODUÇÃO. Confira o host
//    antes de usar --apply: deve ser o do branch de dev, nunca ep-lively-firefly-*.
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const APLICAR = process.argv.includes('--apply')

// Cada passo é idempotente por si (IF NOT EXISTS) — rodar 2x não quebra.
const PASSOS = [
  ['AsaasConfig: kill-switch + wallet + webhook + diagnóstico', `
    ALTER TABLE "AsaasConfig"
      ADD COLUMN IF NOT EXISTS "ativo"              BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "webhookTokenCripto" TEXT,
      ADD COLUMN IF NOT EXISTS "walletIdPlataforma" TEXT,
      ADD COLUMN IF NOT EXISTS "contaNome"          TEXT,
      ADD COLUMN IF NOT EXISTS "contaEmail"         TEXT,
      ADD COLUMN IF NOT EXISTS "ultimoTesteEm"      TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS "ultimoTesteOk"      BOOLEAN,
      ADD COLUMN IF NOT EXISTS "ultimoTesteErro"    TEXT
  `],

  ['AsaasWebhookEvento: idempotência do webhook', `
    CREATE TABLE IF NOT EXISTS "AsaasWebhookEvento" (
      "id"           TEXT PRIMARY KEY,
      "eventoId"     TEXT NOT NULL,
      "evento"       TEXT NOT NULL,
      "sandbox"      BOOLEAN NOT NULL DEFAULT true,
      "pagamentoRef" TEXT,
      "assinaturaRef" TEXT,
      "payload"      JSONB,
      "processadoEm" TIMESTAMPTZ,
      "erro"         TEXT,
      "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `],
  // A trava real de idempotência: o mesmo eventoId nunca entra 2x.
  ['AsaasWebhookEvento: índice único do eventoId', `
    CREATE UNIQUE INDEX IF NOT EXISTS "AsaasWebhookEvento_eventoId_key"
      ON "AsaasWebhookEvento" ("eventoId")
  `],
  ['AsaasWebhookEvento: índice de varredura por evento/data', `
    CREATE INDEX IF NOT EXISTS "AsaasWebhookEvento_evento_idx"
      ON "AsaasWebhookEvento" ("evento", "createdAt" DESC)
  `],
  // Índice PARCIAL: só as linhas que ainda têm payload. É o que torna o expurgo
  // barato o bastante para rodar a cada webhook — sem ele seria varredura na
  // tabela inteira a cada evento, e ela só cresce. Depois de expurgada, a linha
  // sai do índice sozinha.
  ['AsaasWebhookEvento: índice parcial do expurgo (payload não nulo)', `
    CREATE INDEX IF NOT EXISTS "AsaasWebhookEvento_expurgo_idx"
      ON "AsaasWebhookEvento" ("createdAt") WHERE "payload" IS NOT NULL
  `],

  ['AsaasCliente: workspace ↔ customer', `
    CREATE TABLE IF NOT EXISTS "AsaasCliente" (
      "id"          TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "customerId"  TEXT NOT NULL,
      "sandbox"     BOOLEAN NOT NULL DEFAULT true,
      "nome"        TEXT,
      "email"       TEXT,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `],
  // Um customer por workspace POR AMBIENTE (sandbox e produção não se misturam).
  ['AsaasCliente: único por workspace+ambiente', `
    CREATE UNIQUE INDEX IF NOT EXISTS "AsaasCliente_ws_amb_key"
      ON "AsaasCliente" ("workspaceId", "sandbox")
  `],

  ['AsaasAssinatura: assinatura do SOA (novos cadastros)', `
    CREATE TABLE IF NOT EXISTS "AsaasAssinatura" (
      "id"               TEXT PRIMARY KEY,
      "workspaceId"      TEXT NOT NULL,
      "subscriptionId"   TEXT NOT NULL,
      "customerId"       TEXT,
      "sandbox"          BOOLEAN NOT NULL DEFAULT true,
      "ciclo"            TEXT NOT NULL DEFAULT 'MONTHLY',
      "valor"            NUMERIC(12,2) NOT NULL DEFAULT 0,
      "status"           TEXT NOT NULL DEFAULT 'ACTIVE',
      "proximoVencimento" DATE,
      "parceiroId"       TEXT,
      "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `],
  ['AsaasAssinatura: único por subscriptionId', `
    CREATE UNIQUE INDEX IF NOT EXISTS "AsaasAssinatura_sub_key"
      ON "AsaasAssinatura" ("subscriptionId")
  `],
  ['AsaasAssinatura: busca por workspace', `
    CREATE INDEX IF NOT EXISTS "AsaasAssinatura_ws_idx"
      ON "AsaasAssinatura" ("workspaceId", "status")
  `],

  ['AsaasCobranca: cobranças (avulsa ou da assinatura)', `
    CREATE TABLE IF NOT EXISTS "AsaasCobranca" (
      "id"             TEXT PRIMARY KEY,
      "workspaceId"    TEXT,
      "paymentId"      TEXT NOT NULL,
      "subscriptionId" TEXT,
      "sandbox"        BOOLEAN NOT NULL DEFAULT true,
      "finalidade"     TEXT NOT NULL DEFAULT 'assinatura',
      "billingType"    TEXT,
      "valor"          NUMERIC(12,2) NOT NULL DEFAULT 0,
      "valorLiquido"   NUMERIC(12,2),
      "status"         TEXT NOT NULL DEFAULT 'PENDING',
      "vencimento"     DATE,
      "pagoEm"         TIMESTAMPTZ,
      "referencia"     TEXT,
      "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `],
  ['AsaasCobranca: único por paymentId', `
    CREATE UNIQUE INDEX IF NOT EXISTS "AsaasCobranca_pay_key"
      ON "AsaasCobranca" ("paymentId")
  `],
  ['AsaasCobranca: busca por workspace', `
    CREATE INDEX IF NOT EXISTS "AsaasCobranca_ws_idx"
      ON "AsaasCobranca" ("workspaceId", "status")
  `],
]

async function main() {
  console.log(`\n=== Fundação Asaas — ${APLICAR ? 'APLICANDO' : 'DRY-RUN (nada será alterado)'} ===\n`)

  if (!APLICAR) {
    for (const [nome, sql] of PASSOS) {
      console.log(`  [ ] ${nome}`)
      console.log(`      ${sql.trim().split('\n')[0].trim()}…`)
    }
    console.log(`\n${PASSOS.length} passos. Rode com --apply para executar.\n`)
    return
  }

  // Transação única: ou tudo entra, ou nada.
  await prisma.$transaction(async (tx) => {
    for (const [nome, sql] of PASSOS) {
      await tx.$executeRawUnsafe(sql)
      console.log(`  [x] ${nome}`)
    }
  })

  // Conferência: o que existe agora.
  const tabelas = await prisma.$queryRaw`
    SELECT "table_name" AS "tabela"
    FROM information_schema.tables
    WHERE "table_schema" = 'public' AND "table_name" LIKE 'Asaas%'
    ORDER BY 1
  `
  console.log('\nTabelas Asaas:', tabelas.map(t => t.tabela).join(', '))
  console.log('\n✅ Migração aplicada.\n')
}

main()
  .catch(e => { console.error('\n❌ Falhou:', e.message, '\n'); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
