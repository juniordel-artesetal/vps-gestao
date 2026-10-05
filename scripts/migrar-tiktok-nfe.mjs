// Migração ADITIVA — NF-e do pedido TikTok (BR exige a nota antes do envio).
// Colunas novas em "PedidoMarketplace"; IF NOT EXISTS: segura em dev e produção.
//   node --env-file=<env> scripts/migrar-tiktok-nfe.mjs
import { PrismaClient } from '@prisma/client'

const url = (process.env.DIRECT_URL || process.env.DATABASE_URL || '').replace(/-pooler/, '')
const prisma = new PrismaClient({ datasources: { db: { url } } })

const COLUNAS = [
  ['nfeExigida', 'TEXT'],      // need_upload_invoice do TikTok (NEED_INVOICE / NO_NEED / INVOICE_UPLOADED)
  ['nfeXml', 'TEXT'],          // XML da NF-e autorizada anexado pela artesã
  ['nfeChave', 'TEXT'],        // chave de acesso (44 dígitos)
  ['nfeStatus', 'TEXT'],       // PROCESSING / SUCCESS / FAILED / INVALID (upload no TikTok)
  ['nfeErro', 'TEXT'],         // motivo em português
  ['nfeEnviadaEm', 'TIMESTAMPTZ'],
]

async function main() {
  const [db] = await prisma.$queryRawUnsafe('SELECT current_database() AS db')
  console.log(`Banco: ${(() => { try { return new URL(url).host } catch { return '—' } })()} · ${db.db}\n`)
  for (const [c, t] of COLUNAS) await prisma.$executeRawUnsafe(`ALTER TABLE "PedidoMarketplace" ADD COLUMN IF NOT EXISTS "${c}" ${t}`)
  const r = await prisma.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name='PedidoMarketplace' AND column_name LIKE 'nfe%' ORDER BY 1`)
  console.log('✅', r.map(x => x.column_name).join(', '))
}
main().catch(e => { console.error('❌', e.message); process.exit(1) }).finally(() => prisma.$disconnect())
