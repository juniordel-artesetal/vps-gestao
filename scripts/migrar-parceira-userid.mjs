// Migração ADITIVA — Parceiro.userId (vincula parceira à usuária artesã quando são
// a mesma pessoa) + backfill por e-mail idêntico. IF NOT EXISTS: segura dev e prod.
//   node --env-file=<env> scripts/migrar-parceira-userid.mjs
import { PrismaClient } from '@prisma/client'

const url = (process.env.DIRECT_URL || process.env.DATABASE_URL || '').replace(/-pooler/, '')
const prisma = new PrismaClient({ datasources: { db: { url } } })

async function main() {
  console.log(`Banco: ${(() => { try { return new URL(url).host } catch { return '—' } })()}\n`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Parceiro" ADD COLUMN IF NOT EXISTS "userId" TEXT`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Parceiro_userId_idx" ON "Parceiro" ("userId")`)
  // Backfill: vincula por e-mail EXATAMENTE igual (só quem ainda não tem userId).
  const n = await prisma.$executeRawUnsafe(`
    UPDATE "Parceiro" p SET "userId" = u."id"
    FROM "User" u
    WHERE p."userId" IS NULL AND p."email" IS NOT NULL AND lower(p."email") = lower(u."email")
  `)
  const [{ vinc }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS vinc FROM "Parceiro" WHERE "userId" IS NOT NULL`)
  console.log(`✅ Parceiro.userId pronto · backfill vinculou ${n} · total vinculados: ${vinc}`)
}
main().catch(e => { console.error('❌', e.message); process.exit(1) }).finally(() => prisma.$disconnect())
