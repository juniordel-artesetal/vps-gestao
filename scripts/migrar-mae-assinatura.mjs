// Migração ADITIVA — monetização do Método Mãe (MAE) no Asaas: add-on (assinante SOA) e standalone (só o MAE),
// mensal e anual (12× com juros do cliente), trial de 7 dias com cartão.
//  • "Workspace": moduloMae (bool) + moduloMaeOrigem (asaas|cortesia) + moduloMaeCiclo (mensal|anual) +
//    moduloMaePlano (addon|standalone) + moduloMaeAte (date — acesso até; trial/ciclo pago + carência).
//  • "MaeAssinatura": o vínculo com o Asaas (checkout, subscription, status, trial, vencimento) — 1 por workspace.
// IF NOT EXISTS e checagem no catálogo antes do ALTER (Workspace é tabela quente: lock_timeout curto; se não
// conseguir o lock, aborta sem travar ninguém — é só rodar de novo).
//   node --env-file=<env> scripts/migrar-mae-assinatura.mjs
import { PrismaClient } from '@prisma/client'

const url = (process.env.DIRECT_URL || process.env.DATABASE_URL || '').replace(/-pooler/, '')
const prisma = new PrismaClient({ datasources: { db: { url } } })

const COLUNAS = [
  ['moduloMae', 'boolean NOT NULL DEFAULT false'],
  ['moduloMaeOrigem', 'text'],
  ['moduloMaeCiclo', 'text'],
  ['moduloMaePlano', 'text'],
  ['moduloMaeAte', 'date'],
]

async function main() {
  const [{ db }] = await prisma.$queryRawUnsafe(`SELECT current_database() db`)
  console.log(`Banco: ${(() => { try { return new URL(url).host } catch { return '—' } })()} · ${db}\n`)
  for (const [col, tipo] of COLUNAS) {
    const tem = await prisma.$queryRawUnsafe(`SELECT 1 FROM information_schema.columns WHERE table_name = 'Workspace' AND column_name = $1`, col)
    if (tem.length) { console.log(`= Workspace.${col} já existe`); continue }
    await prisma.$transaction([
      prisma.$executeRawUnsafe(`SET LOCAL lock_timeout = '4s'`),
      prisma.$executeRawUnsafe(`ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "${col}" ${tipo}`),
    ])
    console.log(`+ Workspace.${col}`)
  }
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MaeAssinatura" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL UNIQUE,
      "plano" text NOT NULL,
      "ciclo" text NOT NULL,
      "parcelas" int NOT NULL DEFAULT 1,
      "valor" numeric(12,2) NOT NULL DEFAULT 0,
      "status" text NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO',
      "checkoutId" text,
      "checkoutLink" text,
      "subscriptionId" text,
      "customerId" text,
      "trialAte" date,
      "trialUsado" boolean NOT NULL DEFAULT false,
      "proximoVencimento" date,
      "canceladaEm" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MaeAssinatura_checkout_idx" ON "MaeAssinatura" ("checkoutId")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MaeAssinatura_sub_idx" ON "MaeAssinatura" ("subscriptionId")`)
  const cols = await prisma.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name = 'Workspace' AND column_name LIKE 'moduloMae%' ORDER BY 1`)
  const [t] = await prisma.$queryRawUnsafe(`SELECT to_regclass('public."MaeAssinatura"')::text a`)
  console.log('\n✅ Workspace:', cols.map(c => c.column_name).join(', '))
  console.log('✅ MaeAssinatura:', t.a)
}
main().catch(e => { console.error('❌', e.message); process.exit(1) }).finally(() => prisma.$disconnect())
