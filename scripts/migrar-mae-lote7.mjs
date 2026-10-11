// Migração ADITIVA — MAE Lote 7 (itens 119–121):
//  • mae_orders: pedidos do MAE AVULSO (planilha da Shopee / cadastro manual) — tabela nova, não toca em Order;
//  • "SetorConfig"."tipo": tipo da etapa de produção (null | 'impressao'); a Expedição segue no "ehExpedicao".
// IF NOT EXISTS: segura em dev e produção. Roda com o DIRECT_URL do ambiente alvo.
//   node --env-file=<env> scripts/migrar-mae-lote7.mjs
import { PrismaClient } from '@prisma/client'

const url = (process.env.DIRECT_URL || process.env.DATABASE_URL || '').replace(/-pooler/, '')
const prisma = new PrismaClient({ datasources: { db: { url } } })

async function main() {
  const [{ db }] = await prisma.$queryRawUnsafe(`SELECT current_database() db`)
  console.log(`Banco: ${(() => { try { return new URL(url).host } catch { return '—' } })()} · ${db}\n`)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS mae_orders (
      id            text        PRIMARY KEY,
      workspace_id  text        NOT NULL,
      origem        text        NOT NULL,
      numero        text        NOT NULL,
      cliente       text,
      canal         text,
      loja          text,
      itens         jsonb       NOT NULL DEFAULT '[]'::jsonb,
      data_envio    date,
      observacao    text,
      campos        jsonb       NOT NULL DEFAULT '{}'::jsonb,
      ajustes       jsonb       NOT NULL DEFAULT '{}'::jsonb,
      status        text        NOT NULL DEFAULT 'pendente',
      criado_em     timestamptz NOT NULL DEFAULT now(),
      atualizado_em timestamptz NOT NULL DEFAULT now()
    )`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS mae_orders_numero ON mae_orders (workspace_id, origem, numero)`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS mae_orders_ws ON mae_orders (workspace_id, criado_em DESC)`)
  // coluna nova numa tabela pequena (config de etapas); checa antes para não pegar lock à toa
  const tem = await prisma.$queryRawUnsafe(`SELECT 1 FROM information_schema.columns WHERE table_name = 'SetorConfig' AND column_name = 'tipo'`)
  if (!tem.length) await prisma.$executeRawUnsafe(`ALTER TABLE "SetorConfig" ADD COLUMN IF NOT EXISTS "tipo" text`)
  const [t] = await prisma.$queryRawUnsafe(`SELECT to_regclass('public.mae_orders')::text a`)
  const c = await prisma.$queryRawUnsafe(`SELECT data_type FROM information_schema.columns WHERE table_name = 'SetorConfig' AND column_name = 'tipo'`)
  console.log('✅ mae_orders:', t.a)
  console.log('✅ SetorConfig.tipo:', c[0]?.data_type ?? 'AUSENTE')
}
main().catch(e => { console.error('❌', e.message); process.exit(1) }).finally(() => prisma.$disconnect())
