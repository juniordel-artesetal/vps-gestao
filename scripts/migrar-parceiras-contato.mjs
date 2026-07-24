// Migração ADITIVA — Parceiro.whatsapp + Parceiro.instagram (candidatura leve).
// IF NOT EXISTS: segura em dev e produção. Roda com o DIRECT_URL do ambiente alvo.
//   node --env-file=<env> scripts/migrar-parceiras-contato.mjs
import { PrismaClient } from '@prisma/client'

const url = (process.env.DIRECT_URL || process.env.DATABASE_URL || '').replace(/-pooler/, '')
const prisma = new PrismaClient({ datasources: { db: { url } } })

async function main() {
  console.log(`Banco: ${(() => { try { return new URL(url).host } catch { return '—' } })()}\n`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Parceiro" ADD COLUMN IF NOT EXISTS "whatsapp" TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Parceiro" ADD COLUMN IF NOT EXISTS "instagram" TEXT`)
  const cols = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name='Parceiro' AND column_name IN ('whatsapp','instagram')`)
  console.log('✅ Parceiro contato:', cols.map(c => c.column_name).sort().join(', '))
}
main().catch(e => { console.error('❌', e.message); process.exit(1) }).finally(() => prisma.$disconnect())
