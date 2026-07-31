// Garante colunas usadas pela vitrine de Ofertas & Cupons (DistribuidorPromocao).
// A tabela já existe (introspectada); aqui só adicionamos o que falta, de forma idempotente.
import { prisma } from '@/lib/prisma'

let ok = false

export async function ensurePromocoesSchema() {
  if (ok) return
  // "desconto" — badge em destaque no card (ex.: "-20%", "Frete grátis"). Texto livre, opcional.
  await prisma.$executeRawUnsafe(`ALTER TABLE "DistribuidorPromocao" ADD COLUMN IF NOT EXISTS "desconto" text`)
  ok = true
}
