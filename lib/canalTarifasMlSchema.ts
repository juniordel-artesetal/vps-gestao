// Tabela de tarifas fixas do Mercado Livre por faixa de peso × faixa de preço.
// Idempotente — cria a tabela se não existir (espelha o schema de produção).
import { prisma } from '@/lib/prisma'

let ok = false
export async function ensureCanalTarifaML(): Promise<void> {
  if (ok) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CanalTarifaML" (
      "id"          TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "pesoMin"     NUMERIC NOT NULL,
      "pesoMax"     NUMERIC NOT NULL,
      "precoMin"    NUMERIC NOT NULL,
      "precoMax"    NUMERIC,
      "taxaFixa"    NUMERIC NOT NULL DEFAULT 0,
      "ativo"       BOOLEAN NOT NULL DEFAULT true,
      "createdAt"   TIMESTAMP NOT NULL DEFAULT now()
    )
  `)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CanalTarifaML_workspaceId_idx" ON "CanalTarifaML" ("workspaceId")`)
  ok = true
}
