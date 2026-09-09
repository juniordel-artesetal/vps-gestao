// Colunas de 2FA na tabela User — criadas sob demanda, com PRÉ-CHECK no catálogo
// ANTES de qualquer ALTER (regra anti-lock-storm: nunca rodar DDL na User a cada
// cold-start). Só chamado nas rotas de configuração do 2FA, nunca no login.
import { prisma } from '@/lib/prisma'

let jaGarantido = false

export async function garantirColunas2FA(): Promise<void> {
  if (jaGarantido) return
  const cols = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'User'
      AND column_name IN ('twoFactorEnabled', 'twoFactorSecret', 'twoFactorBackup')
  `
  const existentes = new Set(cols.map(c => c.column_name))
  if (existentes.size < 3) {
    // Só ALTER quando falta algo (o IF NOT EXISTS é a segunda trava).
    if (!existentes.has('twoFactorEnabled'))
      await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" boolean NOT NULL DEFAULT false`)
    if (!existentes.has('twoFactorSecret'))
      await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorSecret" text`)
    if (!existentes.has('twoFactorBackup'))
      await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorBackup" text`)
  }
  jaGarantido = true
}
