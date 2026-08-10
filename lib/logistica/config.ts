// Helpers de banco da LogisticaConfig (raw SQL). NUNCA seleciona tokens em listagem.
// Tokens só saem via getTokensInternos() (uso servidor: refresh/chamadas ao provedor).
import { prisma } from '@/lib/prisma'
import { LogisticaConfigPublica } from './tipos'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// Módulo Postagem ligado para o workspace? (default OFF)
export async function moduloPostagemAtivo(workspaceId: string): Promise<boolean> {
  const [row] = await prisma.$queryRaw`
    SELECT COALESCE("moduloPostagem", false) AS "moduloPostagem"
    FROM "Workspace" WHERE "id" = ${workspaceId} LIMIT 1
  ` as any[]
  return !!row?.moduloPostagem
}

// Config pública (SEM tokens) — para telas e checagens de status.
export async function getConfigPublica(workspaceId: string): Promise<LogisticaConfigPublica | null> {
  const [row] = await prisma.$queryRaw`
    SELECT "provedor", "conectado",
           "remetenteNome", "remetenteDoc", "cepOrigem",
           "logradouroOrigem", "numeroOrigem", "bairroOrigem", "cidadeOrigem", "ufOrigem",
           TO_CHAR("tokenExpiraEm", 'YYYY-MM-DD"T"HH24:MI:SSOF') AS "tokenExpiraEm"
    FROM "LogisticaConfig" WHERE "workspaceId" = ${workspaceId} LIMIT 1
  ` as any[]
  return row ?? null
}

// Uso interno do servidor: blobs criptografados + expiração (nunca vai pro client).
export async function getTokensInternos(workspaceId: string): Promise<{
  provedor: string
  accessTokenCripto: string | null
  refreshTokenCripto: string | null
  tokenExpiraEm: Date | null
  conectado: boolean
} | null> {
  const [row] = await prisma.$queryRaw`
    SELECT "provedor", "accessTokenCripto", "refreshTokenCripto", "tokenExpiraEm", "conectado"
    FROM "LogisticaConfig" WHERE "workspaceId" = ${workspaceId} LIMIT 1
  ` as any[]
  return row ?? null
}

// Garante a linha (idempotente).
export async function garantirConfig(workspaceId: string) {
  await prisma.$executeRaw`
    INSERT INTO "LogisticaConfig" ("id","workspaceId","provedor","conectado","createdAt","updatedAt")
    VALUES (${gerarId()}, ${workspaceId}, 'melhorenvio', false, NOW(), NOW())
    ON CONFLICT ("workspaceId") DO NOTHING
  `
}

// Salva tokens (já criptografados) + expiração + marca conectado.
export async function salvarTokens(workspaceId: string, p: {
  accessTokenCripto: string | null
  refreshTokenCripto: string | null
  tokenExpiraEm: Date | null
}) {
  await garantirConfig(workspaceId)
  await prisma.$executeRaw`
    UPDATE "LogisticaConfig"
    SET "accessTokenCripto" = ${p.accessTokenCripto},
        "refreshTokenCripto" = ${p.refreshTokenCripto},
        "tokenExpiraEm" = ${p.tokenExpiraEm},
        "conectado" = ${!!p.accessTokenCripto},
        "updatedAt" = NOW()
    WHERE "workspaceId" = ${workspaceId}
  `
}

// Atualiza dados do remetente.
export async function salvarRemetente(workspaceId: string, r: {
  remetenteNome?: string | null
  remetenteDoc?: string | null
  cepOrigem?: string | null
  logradouroOrigem?: string | null
  numeroOrigem?: string | null
  bairroOrigem?: string | null
  cidadeOrigem?: string | null
  ufOrigem?: string | null
}) {
  await garantirConfig(workspaceId)
  await prisma.$executeRaw`
    UPDATE "LogisticaConfig"
    SET "remetenteNome" = ${r.remetenteNome ?? null},
        "remetenteDoc" = ${r.remetenteDoc ?? null},
        "cepOrigem" = ${r.cepOrigem ?? null},
        "logradouroOrigem" = ${r.logradouroOrigem ?? null},
        "numeroOrigem" = ${r.numeroOrigem ?? null},
        "bairroOrigem" = ${r.bairroOrigem ?? null},
        "cidadeOrigem" = ${r.cidadeOrigem ?? null},
        "ufOrigem" = ${r.ufOrigem ?? null},
        "updatedAt" = NOW()
    WHERE "workspaceId" = ${workspaceId}
  `
}

// Desconecta (limpa tokens).
export async function desconectar(workspaceId: string) {
  await prisma.$executeRaw`
    UPDATE "LogisticaConfig"
    SET "accessTokenCripto" = NULL, "refreshTokenCripto" = NULL, "tokenExpiraEm" = NULL,
        "conectado" = false, "updatedAt" = NOW()
    WHERE "workspaceId" = ${workspaceId}
  `
}
