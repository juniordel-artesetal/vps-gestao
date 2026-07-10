import { prisma } from '@/lib/prisma'

// Fase 2 da Loja: atributos por produto (ex.: Tamanho, Quantidade), suas opções e o
// mapeamento variação → (uma opção de cada atributo). Idempotente. NUNCA SELECT * aqui.
export async function ensureLojaAtributos() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "LojaAtributo" (
        "id" text PRIMARY KEY, "workspaceId" text NOT NULL, "produtoId" text NOT NULL,
        "nome" text NOT NULL, "ordem" int NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now())`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "LojaAtributo_uniq" ON "LojaAtributo" ("produtoId","nome")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LojaAtributo_prod_idx" ON "LojaAtributo" ("produtoId","ordem")`)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "LojaAtributoOpcao" (
        "id" text PRIMARY KEY, "workspaceId" text NOT NULL, "atributoId" text NOT NULL,
        "valor" text NOT NULL, "ordem" int NOT NULL DEFAULT 0)`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "LojaAtributoOpcao_uniq" ON "LojaAtributoOpcao" ("atributoId","valor")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LojaAtributoOpcao_attr_idx" ON "LojaAtributoOpcao" ("atributoId","ordem")`)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "LojaVariacaoOpcao" (
        "id" text PRIMARY KEY, "workspaceId" text NOT NULL, "variacaoId" text NOT NULL,
        "atributoId" text NOT NULL, "opcaoId" text NOT NULL)`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "LVO_var_attr" ON "LojaVariacaoOpcao" ("variacaoId","atributoId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LVO_opcao_idx" ON "LojaVariacaoOpcao" ("opcaoId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LVO_var_idx" ON "LojaVariacaoOpcao" ("variacaoId")`)
  } catch (e) { console.warn('[lojaAtributos] ensure:', e) }
}
