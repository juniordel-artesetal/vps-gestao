// Migração ADITIVA — tabela ParceiroAviso (idempotência do resumo semanal da
// parceira, por competência ISO). Só cria; nunca altera dado existente.
//
//   node --env-file=.env.local scripts/migrar-parceiras-aviso.mjs
// Guarda dura: recusa rodar contra o Neon de PRODUÇÃO (ep-lively-firefly).
import { PrismaClient } from '@prisma/client'

const url = process.env.DIRECT_URL || process.env.DATABASE_URL || ''
if (url.includes('ep-lively-firefly')) { console.error('❌ APONTA PARA PRODUÇÃO — abortado'); process.exit(1) }
const prisma = new PrismaClient()

async function main() {
  console.log(`Banco: ${new URL(url).host}\n`)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ParceiroAviso" (
      "id" text PRIMARY KEY,
      "parceiroId" text NOT NULL,
      "tipo" text NOT NULL,
      "competencia" text NOT NULL,
      "enviadoEm" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ParceiroAviso_parceiroId_tipo_competencia_key"
      ON "ParceiroAviso" ("parceiroId","tipo","competencia")
  `)
  const cols = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name='ParceiroAviso' ORDER BY ordinal_position`)
  console.log('✅ ParceiroAviso pronta:', cols.map(c => c.column_name).join(', '))
}
main().catch(e => { console.error('❌', e.message); process.exit(1) }).finally(() => prisma.$disconnect())
