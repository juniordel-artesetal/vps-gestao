// Coluna opcional de TEMPO por peça (minutos) na PrecVariacao — usada pelo rateio de
// custos fixos por horas e (opcionalmente) para refinar a mão de obra. Idempotente.
import { prisma } from '@/lib/prisma'

let ok = false
export async function ensureTempoMinutos(): Promise<void> {
  if (ok) return
  await prisma.$executeRawUnsafe(`ALTER TABLE "PrecVariacao" ADD COLUMN IF NOT EXISTS "tempoMinutos" INTEGER NOT NULL DEFAULT 0`)
  ok = true
}
