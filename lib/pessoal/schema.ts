// Módulo PESSOAL — add-on privado POR USUÁRIO (nunca por workspace).
// Toda tabela tem "userId" (escopo = session.user.id) + FK para User (cascade).
// FINANÇAS = versão completa (PessoalConta + PessoalCategoria + PessoalLancamento
// com contaId/metodo + PessoalMeta), escopo por usuário.
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

  // ── FINANÇAS (versão completa: contas + categorias + lançamentos + metas) ──
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PessoalConta" (
      "id" text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "nome" text NOT NULL, "tipo" text NOT NULL DEFAULT 'CORRENTE', "instituicao" text,
      "saldoInicial" numeric(12,2) NOT NULL DEFAULT 0, "cor" text,
      "ativo" boolean NOT NULL DEFAULT true,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalConta_user_idx" ON "PessoalConta" ("userId")`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalConta" ADD COLUMN IF NOT EXISTS "instituicao" text`)

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
      "tipo" text NOT NULL DEFAULT 'DESPESA', "categoriaId" text, "contaId" text,
      "descricao" text NOT NULL, "valor" numeric(12,2) NOT NULL DEFAULT 0, "data" date NOT NULL,
      "metodo" text, "referencia" text, "observacoes" text,
      "status" text NOT NULL DEFAULT 'PAGO',
      "recorrenciaId" text, "recorrencia" text, "parcela" integer, "totalParcelas" integer,
      "origem" text NOT NULL DEFAULT 'MANUAL',
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalLancamento_user_idx" ON "PessoalLancamento" ("userId")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalLancamento_user_data_idx" ON "PessoalLancamento" ("userId","data")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalLancamento_user_status_idx" ON "PessoalLancamento" ("userId","status")`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalLancamento" ADD COLUMN IF NOT EXISTS "comprovante" text`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalLancamento" ADD COLUMN IF NOT EXISTS "caixinhaId" text`)
  // Alinhamento p/ instalações anteriores (aditivo: re-add conta/método; remove canal que não serve).
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalLancamento" ADD COLUMN IF NOT EXISTS "contaId" text`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalLancamento" ADD COLUMN IF NOT EXISTS "metodo" text`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalLancamento" ADD COLUMN IF NOT EXISTS "referencia" text`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalLancamento" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'PAGO'`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalLancamento" DROP COLUMN IF EXISTS "canal"`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalLancamento" DROP COLUMN IF EXISTS "dataVencimento"`)

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

  // ── CAIXINHAS (estilo Nubank: reservas com meta) ──────────────────────────
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PessoalCaixinha" (
      "id" text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "nome" text NOT NULL, "cor" text, "meta" numeric(12,2),
      "saldo" numeric(12,2) NOT NULL DEFAULT 0,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalCaixinha_user_idx" ON "PessoalCaixinha" ("userId")`)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PessoalCaixinhaMov" (
      "id" text PRIMARY KEY,
      "caixinhaId" text NOT NULL REFERENCES "PessoalCaixinha"("id") ON DELETE CASCADE,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "tipo" text NOT NULL, "valor" numeric(12,2) NOT NULL DEFAULT 0, "data" date NOT NULL,
      "contaId" text, "obs" text,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalCaixinhaMov_cx_idx" ON "PessoalCaixinhaMov" ("caixinhaId")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalCaixinhaMov_user_idx" ON "PessoalCaixinhaMov" ("userId")`)
  // Vínculo opcional com o lançamento que originou o movimento (envelope de gastos).
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalCaixinhaMov" ADD COLUMN IF NOT EXISTS "lancamentoId" text`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalCaixinhaMov_lanc_idx" ON "PessoalCaixinhaMov" ("lancamentoId")`)

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
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalTarefa" ADD COLUMN IF NOT EXISTS "imagem" text`)
  // Lembrete (timestamp) + dedup do disparo; vínculo opcional com uma nota; ordenação manual.
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalTarefa" ADD COLUMN IF NOT EXISTS "lembrete" timestamptz`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalTarefa" ADD COLUMN IF NOT EXISTS "lembreteEnviado" boolean NOT NULL DEFAULT false`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalTarefa" ADD COLUMN IF NOT EXISTS "notaId" text`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalTarefa" ADD COLUMN IF NOT EXISTS "ordem" integer NOT NULL DEFAULT 0`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalTarefa_lembrete_idx" ON "PessoalTarefa" ("lembrete") WHERE "lembrete" IS NOT NULL AND NOT "lembreteEnviado"`)

  // ── NOTAS (Evernote: cadernos + tags + rich text HTML + arquivar/favoritar) ──
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PessoalNota" (
      "id" text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "titulo" text, "conteudo" text, "cor" text, "fixada" boolean NOT NULL DEFAULT false,
      "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalNota_user_idx" ON "PessoalNota" ("userId")`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalNota" ADD COLUMN IF NOT EXISTS "imagem" text`)
  // Upgrade Keep→Evernote: caderno, resumo (texto puro p/ busca/preview), favorita, arquivada.
  // "conteudo" passa a guardar HTML do editor (retrocompatível: texto puro vira <p> no editor).
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalNota" ADD COLUMN IF NOT EXISTS "cadernoId" text`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalNota" ADD COLUMN IF NOT EXISTS "resumo" text`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalNota" ADD COLUMN IF NOT EXISTS "favorita" boolean NOT NULL DEFAULT false`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalNota" ADD COLUMN IF NOT EXISTS "arquivada" boolean NOT NULL DEFAULT false`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalNota_user_caderno_idx" ON "PessoalNota" ("userId","cadernoId")`)

  // Cadernos (organização clássica). arquivado = fica na lixeira/oculto sem apagar notas.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PessoalCaderno" (
      "id" text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "nome" text NOT NULL, "cor" text, "icone" text, "ordem" integer NOT NULL DEFAULT 0,
      "arquivado" boolean NOT NULL DEFAULT false,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalCaderno_user_idx" ON "PessoalCaderno" ("userId")`)

  // Tags + junction N:N nota↔tag. Escopo por userId (a tag é privada).
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PessoalTag" (
      "id" text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "nome" text NOT NULL, "cor" text,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalTag_user_idx" ON "PessoalTag" ("userId")`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PessoalTag_user_nome_uidx" ON "PessoalTag" ("userId", lower("nome"))`)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PessoalNotaTag" (
      "notaId" text NOT NULL REFERENCES "PessoalNota"("id") ON DELETE CASCADE,
      "tagId" text NOT NULL REFERENCES "PessoalTag"("id") ON DELETE CASCADE,
      PRIMARY KEY ("notaId","tagId")
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalNotaTag_tag_idx" ON "PessoalNotaTag" ("tagId")`)

  // Anexos da nota (Fase 3) — armazenados no PRÓPRIO Neon (bytea), sem storage externo.
  // Servidos por rota gated (sessão+userId). Escopo por userId; cascade ao apagar a nota.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PessoalAnexo" (
      "id" text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "notaId" text NOT NULL REFERENCES "PessoalNota"("id") ON DELETE CASCADE,
      "nome" text NOT NULL, "conteudo" bytea NOT NULL, "tipo" text, "tamanho" integer NOT NULL DEFAULT 0,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalAnexo_user_idx" ON "PessoalAnexo" ("userId")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalAnexo_nota_idx" ON "PessoalAnexo" ("notaId")`)
  // Alinhamento p/ a versão Blob anterior (que gravava "url"): passa a guardar bytea no banco.
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalAnexo" ADD COLUMN IF NOT EXISTS "conteudo" bytea`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalAnexo" DROP COLUMN IF EXISTS "url"`)

  // ── TELEGRAM (passo 5) — BYO-bot: cada usuário cola o token do PRÓPRIO bot (criptografado).
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PessoalTelegramLink" (
      "id" text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "botTokenCriptografado" text, "botUsername" text, "webhookId" text,
      "telegramChatId" text, "telegramUsername" text,
      "status" text NOT NULL DEFAULT 'PENDENTE',
      "vinculadoEm" timestamptz NOT NULL DEFAULT now(), "ativo" boolean NOT NULL DEFAULT true
    )`)
  // Alinhamento p/ instalações do fluxo anterior (código/deep-link → BYO-bot).
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalTelegramLink" ADD COLUMN IF NOT EXISTS "botTokenCriptografado" text`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalTelegramLink" ADD COLUMN IF NOT EXISTS "botUsername" text`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalTelegramLink" ADD COLUMN IF NOT EXISTS "webhookId" text`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalTelegramLink" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'PENDENTE'`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalTelegramLink" DROP COLUMN IF EXISTS "codigo"`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalTelegramLink" DROP COLUMN IF EXISTS "expiraEm"`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PessoalTelegramLink_user_uidx" ON "PessoalTelegramLink" ("userId")`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PessoalTelegramLink_webhook_uidx" ON "PessoalTelegramLink" ("webhookId")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PessoalTelegramLink_chat_idx" ON "PessoalTelegramLink" ("telegramChatId")`)
  // On/off dos avisos proativos (vencimentos + entradas previstas). Default ligado.
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalTelegramLink" ADD COLUMN IF NOT EXISTS "avisosAtivos" boolean NOT NULL DEFAULT true`)
  // Estado transitório: quando a intenção fica ambígua, guarda a mensagem/foto e pergunta o tipo.
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalTelegramLink" ADD COLUMN IF NOT EXISTS "pendenteTexto" text`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalTelegramLink" ADD COLUMN IF NOT EXISTS "pendenteImagem" text`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PessoalTelegramLink" ADD COLUMN IF NOT EXISTS "pendenteEm" timestamptz`)

  // Dedup dos avisos diários (não avisa a mesma pessoa 2x no mesmo dia). Escopo por userId.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PessoalAvisoDia" (
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "dia" date NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("userId","dia")
    )`)

  ok = true
}
