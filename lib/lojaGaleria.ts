import { prisma } from '@/lib/prisma'

// Máximo de fotos por dono (produto OU variação)
export const MAX_IMAGENS_LOJA = 10

// Self-provisiona a visibilidade por variação e a galeria da loja (idempotente).
// O backfill de visivelLoja é migração única (rodada no deploy desta versão) — NÃO
// entra aqui para não reativar itens que a artesã desmarcar depois.
export async function ensureLojaGaleria() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "PrecVariacao" ADD COLUMN IF NOT EXISTS "visivelLoja" boolean NOT NULL DEFAULT false`)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "LojaImagem" (
        "id" text PRIMARY KEY, "workspaceId" text NOT NULL,
        "produtoId" text, "variacaoId" text,
        "imagem" text NOT NULL, "ordem" int NOT NULL DEFAULT 0,
        "capa" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CHECK (("produtoId" IS NOT NULL) <> ("variacaoId" IS NOT NULL)))`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LojaImagem_prod_idx" ON "LojaImagem" ("produtoId","ordem")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LojaImagem_var_idx" ON "LojaImagem" ("variacaoId","ordem")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LojaImagem_ws_idx" ON "LojaImagem" ("workspaceId")`)
  } catch (e) { console.warn('[lojaGaleria] ensure:', e) }
}
