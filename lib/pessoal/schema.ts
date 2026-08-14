// Módulo PESSOAL — add-on privado POR USUÁRIO (nunca por workspace).
// Toda tabela tem "userId" (escopo = session.user.id) + FK para User (cascade).
// Migração ADITIVA e idempotente (CREATE TABLE IF NOT EXISTS) — padrão do projeto.
// Dinheiro em numeric(12,2) (exato). Nada aqui toca tabelas existentes.
import { prisma } from '@/lib/prisma'

let ok = false
export async function ensurePessoalTables() {
  if (ok) return
  // Assinatura do add-on (billing Asaas). status: ATIVA|PENDENTE|INADIMPLENTE|CANCELADA
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PessoalAssinatura" (
      "id" text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "asaasCustomerId" text,
      "asaasSubscriptionId" text,
      "status" text NOT NULL DEFAULT 'PENDENTE',
      "valor" numeric(12,2) NOT NULL DEFAULT 0,
      "proximoVencimento" date,
      "ativadaEm" timestamptz,
      "canceladaEm" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PessoalAssinatura_user_uidx" ON "PessoalAssinatura" ("userId")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalAssinatura_sub_idx" ON "PessoalAssinatura" ("asaasSubscriptionId")`)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PessoalConta" (
      "id" text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "nome" text NOT NULL,
      "tipo" text,
      "instituicao" text,
      "saldoInicial" numeric(12,2) NOT NULL DEFAULT 0,
      "cor" text,
      "ativo" boolean NOT NULL DEFAULT true,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalConta_user_idx" ON "PessoalConta" ("userId")`)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PessoalCategoria" (
      "id" text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "nome" text NOT NULL,
      "tipo" text NOT NULL DEFAULT 'DESPESA',
      "cor" text,
      "icone" text,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalCategoria_user_idx" ON "PessoalCategoria" ("userId")`)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PessoalLancamento" (
      "id" text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "tipo" text NOT NULL DEFAULT 'DESPESA',
      "categoriaId" text,
      "contaId" text,
      "descricao" text NOT NULL,
      "valor" numeric(12,2) NOT NULL DEFAULT 0,
      "data" date NOT NULL,
      "metodo" text,
      "observacoes" text,
      "origem" text NOT NULL DEFAULT 'MANUAL',
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalLancamento_user_idx" ON "PessoalLancamento" ("userId")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalLancamento_user_data_idx" ON "PessoalLancamento" ("userId","data")`)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PessoalTarefa" (
      "id" text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "titulo" text NOT NULL,
      "descricao" text,
      "prazo" date,
      "prioridade" text,
      "status" text NOT NULL DEFAULT 'ABERTA',
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "concluidaEm" timestamptz
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalTarefa_user_idx" ON "PessoalTarefa" ("userId")`)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PessoalNota" (
      "id" text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "titulo" text,
      "conteudo" text,
      "cor" text,
      "fixada" boolean NOT NULL DEFAULT false,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalNota_user_idx" ON "PessoalNota" ("userId")`)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PessoalTelegramLink" (
      "id" text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "telegramChatId" text,
      "telegramUsername" text,
      "vinculadoEm" timestamptz NOT NULL DEFAULT now(),
      "ativo" boolean NOT NULL DEFAULT true
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalTelegramLink_user_idx" ON "PessoalTelegramLink" ("userId")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalTelegramLink_chat_idx" ON "PessoalTelegramLink" ("telegramChatId")`)

  ok = true
}
