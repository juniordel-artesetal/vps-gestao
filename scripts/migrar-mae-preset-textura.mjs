// Migração ADITIVA — Lote 4 do MAE (item 51): o preset de efeito guarda também o papel dentro do texto.
// IF NOT EXISTS: segura em dev e produção. Roda com o DIRECT_URL do ambiente alvo.
//   node --env-file=<env> scripts/migrar-mae-preset-textura.mjs
import { PrismaClient } from '@prisma/client'

const url = (process.env.DIRECT_URL || process.env.DATABASE_URL || '').replace(/-pooler/, '')
const prisma = new PrismaClient({ datasources: { db: { url } } })

async function main() {
  const [{ db }] = await prisma.$queryRawUnsafe(`SELECT current_database() db`)
  console.log(`Banco: ${(() => { try { return new URL(url).host } catch { return '—' } })()} · ${db}`)
  await prisma.$executeRawUnsafe(`ALTER TABLE mae_effect_presets ADD COLUMN IF NOT EXISTS textura jsonb`)
  const [c] = await prisma.$queryRawUnsafe(`SELECT data_type FROM information_schema.columns WHERE table_name = 'mae_effect_presets' AND column_name = 'textura'`)
  console.log('✅ mae_effect_presets.textura:', c?.data_type)
}
main().catch(e => { console.error('❌', e.message); process.exit(1) }).finally(() => prisma.$disconnect())
