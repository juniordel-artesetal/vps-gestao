// Migração ADITIVA — avisos de novo pedido da loja (chamado Y20A): 1 linha por workspace com o "visto"
// (Sofia + pop-up) e a config dos canais (e-mail / Sofia / pop-up). Tabela nova: não toca em Workspace/Order.
// IF NOT EXISTS: segura em dev e produção. Roda com o DIRECT_URL do ambiente alvo.
//   node --env-file=<env> scripts/migrar-loja-avisos-pedido.mjs
import { PrismaClient } from '@prisma/client'

const url = (process.env.DIRECT_URL || process.env.DATABASE_URL || '').replace(/-pooler/, '')
const prisma = new PrismaClient({ datasources: { db: { url } } })

async function main() {
  const [{ db }] = await prisma.$queryRawUnsafe(`SELECT current_database() db`)
  console.log(`Banco: ${(() => { try { return new URL(url).host } catch { return '—' } })()} · ${db}\n`)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LojaAvisoPedido" (
      "workspaceId" text PRIMARY KEY,
      "vistoEm" timestamptz,
      "popupVistoEm" timestamptz,
      "emailAtivo" boolean NOT NULL DEFAULT true,
      "sofiaAtivo" boolean NOT NULL DEFAULT true,
      "popupAtivo" boolean NOT NULL DEFAULT true,
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`)
  const [t] = await prisma.$queryRawUnsafe(`SELECT to_regclass('public."LojaAvisoPedido"')::text a`)
  console.log('✅ LojaAvisoPedido:', t.a)
}
main().catch(e => { console.error('❌', e.message); process.exit(1) }).finally(() => prisma.$disconnect())
