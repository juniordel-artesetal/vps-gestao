// Migração ADITIVA — MAE: RASCUNHO AUTOMÁTICO no servidor (proteção contra perda, 12/10/2026).
//  • mae_rascunhos: o trabalho NÃO SALVO de cada base/tema (o último estado da tela), por conta. Uma linha por
//    (conta, tipo, id do documento) — sobrescrita a cada envio; apagada quando a usuária salva de verdade.
//    Não toca em mae_bases/mae_themes (as versões salvas continuam como estão).
// IF NOT EXISTS: segura em dev e produção. Roda com o DIRECT_URL do ambiente alvo.
//   node --env-file=<env> scripts/migrar-mae-rascunhos.mjs
import { PrismaClient } from '@prisma/client'

const url = (process.env.DIRECT_URL || process.env.DATABASE_URL || '').replace(/-pooler/, '')
const prisma = new PrismaClient({ datasources: { db: { url } } })

async function main() {
  const [{ db }] = await prisma.$queryRawUnsafe(`SELECT current_database() db`)
  console.log(`Banco: ${(() => { try { return new URL(url).host } catch { return '—' } })()} · ${db}\n`)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS mae_rascunhos (
      workspace_id  text        NOT NULL,
      tipo          text        NOT NULL,
      doc_id        text        NOT NULL,
      nome          text        NOT NULL,
      versao        integer     NOT NULL,
      doc           jsonb       NOT NULL,
      editado_em    timestamptz NOT NULL,
      atualizado_em timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (workspace_id, tipo, doc_id)
    )`)
  const [{ n }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int n FROM mae_rascunhos`)
  console.log(`mae_rascunhos ok (${n} linhas)`)
}
main().catch(e => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
