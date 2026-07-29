// Colunas de LOJA no PrecCombo (publicar combo na vitrine). Idempotente.
import { prisma } from '@/lib/prisma'

let ok = false
export async function ensureComboLoja(): Promise<void> {
  if (ok) return
  await prisma.$executeRawUnsafe(`ALTER TABLE "PrecCombo" ADD COLUMN IF NOT EXISTS "visivelLoja" BOOLEAN NOT NULL DEFAULT false`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PrecCombo" ADD COLUMN IF NOT EXISTS "lojaColecaoId" TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PrecCombo" ADD COLUMN IF NOT EXISTS "lojaOrdem" INTEGER NOT NULL DEFAULT 0`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "PrecCombo" ADD COLUMN IF NOT EXISTS "lojaDestaque" BOOLEAN NOT NULL DEFAULT false`)
  ok = true
}
