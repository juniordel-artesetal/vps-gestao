// Garante a tabela LojaDominio (domínio próprio da Loja). Tabela NOVA → CREATE TABLE IF
// NOT EXISTS é barato e idempotente (não é ALTER na Workspace; não causa lock storm).
// Roda no máx. 1x por processo (guard de módulo).
import { prisma } from '@/lib/prisma'

let garantido = false

export async function ensureLojaDominioSchema() {
  if (garantido) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LojaDominio" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "dominio" text NOT NULL,
      "status" text NOT NULL DEFAULT 'PENDENTE',
      "instrucoesDns" jsonb,
      "verificadoEm" timestamp,
      "criadoEm" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "LojaDominio_dominio_key" UNIQUE ("dominio"),
      CONSTRAINT "LojaDominio_workspaceId_key" UNIQUE ("workspaceId")
    )
  `)
  garantido = true
}

export type LojaDominioRow = {
  id: string
  workspaceId: string
  dominio: string
  status: 'PENDENTE' | 'VERIFICANDO' | 'ATIVO' | 'ERRO'
  instrucoesDns: any
  verificadoEm: string | null
  criadoEm: string
}
