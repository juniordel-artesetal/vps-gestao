// Módulo PESSOAL — add-on privado POR USUÁRIO (nunca por workspace).
// Toda tabela tem "userId" (escopo = session.user.id) + FK para User (cascade).
// FINANÇAS = clone fiel do financeiro do ateliê (PessoalCategoria=FinCategoria,
// PessoalLancamento=FinLancamento, PessoalMeta=FinMeta), trocando só o escopo.
// Idempotente. Dinheiro em numeric(12,2). Nada aqui toca tabelas existentes.
import { prisma } from '@/lib/prisma'

let ok = false
export async function ensurePessoalTables() {
  if (ok) return
  // Assinatura do add-on (billing Asaas). status: ATIVA|PENDENTE|INADIMPLENTE|CANCELADA
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PessoalAssinatura" (
      "id" text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "asaasCustomerId" text, "asaasSubscriptionId" text,
      "status" text NOT NULL DEFAULT 'PENDENTE',
      "valor" numeric(12,2) NOT NULL DEFAULT 0,
      "proximoVencimento" date, "ativadaEm" timestamptz, "canceladaEm" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PessoalAssinatura_user_uidx" ON "PessoalAssinatura" ("userId")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalAssinatura_sub_idx" ON "PessoalAssinatura" ("asaasSubscriptionId")`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalAssinatura" ADD COLUMN IF NOT EXISTS "emailAtivacaoEnviado" boolean NOT NULL DEFAULT false`)

  // ── FINANÇAS (espelho do ateliê) ──────────────────────────────────────────
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PessoalCategoria" (
      "id" text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "nome" text NOT NULL, "tipo" text NOT NULL DEFAULT 'DESPESA', "cor" text, "icone" text,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalCategoria_user_idx" ON "PessoalCategoria" ("userId")`)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PessoalLancamento" (
      "id" text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "tipo" text NOT NULL DEFAULT 'DESPESA', "categoriaId" text,
      "descricao" text NOT NULL, "valor" numeric(12,2) NOT NULL DEFAULT 0, "data" date NOT NULL,
      "canal" text, "referencia" text, "observacoes" text,
      "status" text NOT NULL DEFAULT 'PAGO',
      "recorrenciaId" text, "recorrencia" text, "parcela" integer, "totalParcelas" integer,
      "origem" text NOT NULL DEFAULT 'MANUAL',
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalLancamento_user_idx" ON "PessoalLancamento" ("userId")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalLancamento_user_data_idx" ON "PessoalLancamento" ("userId","data")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalLancamento_user_status_idx" ON "PessoalLancamento" ("userId","status")`)
  // Alinhamento p/ instalações antigas do passo 1 (aditivo + limpeza do que saiu do modelo).
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalLancamento" ADD COLUMN IF NOT EXISTS "canal" text`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalLancamento" ADD COLUMN IF NOT EXISTS "referencia" text`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalLancamento" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'PAGO'`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalLancamento" DROP COLUMN IF EXISTS "contaId"`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalLancamento" DROP COLUMN IF EXISTS "metodo"`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalLancamento" DROP COLUMN IF EXISTS "dataVencimento"`)
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "PessoalConta"`)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PessoalMeta" (
      "id" text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "ano" integer NOT NULL, "mes" integer NOT NULL,
      "metaReceita" numeric(12,2), "metaDespesa" numeric(12,2), "metaLucro" numeric(12,2),
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PessoalMeta_user_ym_uidx" ON "PessoalMeta" ("userId","ano","mes")`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalMeta" ADD COLUMN IF NOT EXISTS "metaLucro" numeric(12,2)`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalMeta" DROP COLUMN IF EXISTS "metaEconomia"`)

  // ── TAREFAS ───────────────────────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PessoalTarefa" (
      "id" text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "titulo" text NOT NULL, "descricao" text, "prazo" date, "prioridade" text,
      "status" text NOT NULL DEFAULT 'PENDENTE',
      "createdAt" timestamptz NOT NULL DEFAULT now(), "concluidaEm" timestamptz
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalTarefa_user_idx" ON "PessoalTarefa" ("userId")`)

  // ── NOTAS ─────────────────────────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PessoalNota" (
      "id" text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "titulo" text, "conteudo" text, "cor" text, "fixada" boolean NOT NULL DEFAULT false,
      "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalNota_user_idx" ON "PessoalNota" ("userId")`)

  // ── TELEGRAM (passo 5) ────────────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PessoalTelegramLink" (
      "id" text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "telegramChatId" text, "telegramUsername" text,
      "vinculadoEm" timestamptz NOT NULL DEFAULT now(), "ativo" boolean NOT NULL DEFAULT true
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalTelegramLink_user_idx" ON "PessoalTelegramLink" ("userId")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalTelegramLink_chat_idx" ON "PessoalTelegramLink" ("telegramChatId")`)

  ok = true
}
