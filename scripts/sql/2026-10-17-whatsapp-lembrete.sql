-- WhatsApp: lembrete de cobrança + opt-out (17/10/2026). Aditivo (só cria tabelas novas). Rodado UMA vez no neondb de
-- produção — nunca em runtime (lição do lock storm: DDL no caminho da requisição trava a Workspace).

-- 1 linha por (cobrança, degrau, canal): o mesmo degrau nunca sai duas vezes para a mesma cobrança.
CREATE TABLE IF NOT EXISTS "WhatsappLembrete" (
  "id"          text PRIMARY KEY,
  "workspaceId" text NOT NULL,
  "cobrancaId"  text NOT NULL,            -- paymentId do Asaas
  "degrau"      integer NOT NULL,         -- 0, 1, 3, 7 (dias depois do vencimento)
  "canal"       text NOT NULL DEFAULT 'whatsapp',
  "status"      text NOT NULL,            -- ENVIANDO | ENFILEIRADO | ERRO
  "telefone"    text,
  "envioId"     text,                     -- id do envio na fila do serviço
  "erro"        text,
  "enviadoEm"   timestamptz,
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "WhatsappLembrete_cobranca_degrau_canal" UNIQUE ("cobrancaId", "degrau", "canal")
);
CREATE INDEX IF NOT EXISTS "WhatsappLembrete_ws_idx" ON "WhatsappLembrete" ("workspaceId");

-- Quem respondeu PARAR. Chave = DDD + 8 últimos dígitos (o WhatsApp às vezes manda o número sem o 9).
CREATE TABLE IF NOT EXISTS "WhatsappOptOut" (
  "chave"       text PRIMARY KEY,
  "workspaceId" text,
  "origem"      text,
  "criadoEm"    timestamptz NOT NULL DEFAULT now()
);
