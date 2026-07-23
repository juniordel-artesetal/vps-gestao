// ─────────────────────────────────────────────────────────────────────────────
// CHECK constraint em ParceiroComissao.status.
//
// A coluna é texto livre. Com dois mecanismos de pagamento convivendo (split do
// Asaas e payout manual), um status inventado num deles significa comissão paga
// duas vezes ou nunca — o CHECK fecha essa porta no banco, não na disciplina.
//
//   pendente        → a acertar; ninguém pagou ainda
//   pago_via_split  → o Asaas repassou sozinho (parceiro com walletId)
//   pago_manual     → o Júnior transferiu na mão
//   cancelado       → estornada/chargeback, ou o acordo caiu
//
// ⚠️ Confere ANTES se há valor fora da lista — a constraint falharia e derrubaria
//    a transação. Hoje a tabela tem 0 linhas.
//
// USO (a ORDEM dos --env-file importa: o último vence):
//   node --env-file=.env --env-file=.env.local scripts/migrar-comissao-status.mjs
//   node --env-file=.env --env-file=.env.local scripts/migrar-comissao-status.mjs --apply
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const APLICAR = process.argv.includes('--apply')
const VALIDOS = ['pendente', 'pago_via_split', 'pago_manual', 'cancelado']

async function main() {
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '?' } })()
  console.log(`\n=== CHECK de ParceiroComissao.status — ${APLICAR ? 'APLICANDO' : 'DRY-RUN'} ===`)
  console.log(`Banco: ${host}\n`)

  const [{ n }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "ParceiroComissao"`)
  console.log(`  linhas na tabela: ${n}`)

  const atuais = await prisma.$queryRawUnsafe(
    `SELECT "status", COUNT(*)::int AS n FROM "ParceiroComissao" GROUP BY 1 ORDER BY 2 DESC`)
  console.log(`  valores hoje: ${atuais.length ? atuais.map(a => `${a.status}(${a.n})`).join(', ') : '(nenhum)'}`)

  const forasteiros = atuais.filter(a => !VALIDOS.includes(a.status))
  if (forasteiros.length) {
    console.error(`\n❌ Há status fora da lista: ${forasteiros.map(f => f.status).join(', ')}`)
    console.error('   A constraint falharia. Normalize os dados antes.\n')
    process.exitCode = 1
    return
  }
  console.log(`  ✅ nenhum valor fora de: ${VALIDOS.join(', ')}`)

  if (!APLICAR) { console.log('\n  Rode com --apply para criar a constraint.\n'); return }

  // DROP antes de ADD para ser re-executável.
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ParceiroComissao" DROP CONSTRAINT IF EXISTS "ParceiroComissao_status_check"`)
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ParceiroComissao" ADD CONSTRAINT "ParceiroComissao_status_check"
     CHECK ("status" IN (${VALIDOS.map(v => `'${v}'`).join(', ')}))`)
  console.log('\n  [x] constraint criada')

  // Prova que ela morde: um status inválido tem de ser recusado.
  let recusou = false
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ParceiroComissao" ("id","parceiroId","workspaceId","competencia","base","percentual","valor","status","createdAt")
       VALUES ('chk_teste','x','y','2026-07',0,0,0,'status_invalido',NOW())`)
  } catch { recusou = true }
  await prisma.$executeRawUnsafe(`DELETE FROM "ParceiroComissao" WHERE "id" = 'chk_teste'`).catch(() => {})
  console.log(`  ${recusou ? '✅' : '❌'} status inválido é recusado pelo banco`)

  const [{ n: depois }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "ParceiroComissao"`)
  console.log(`\n  linhas: ${n} antes, ${depois} depois`)
  console.log(recusou && n === depois ? '\n✅ Aplicada.\n' : '\n❌ Algo saiu do esperado.\n')
  if (!recusou || n !== depois) process.exitCode = 1
}

main()
  .catch(e => { console.error('\n❌ Falhou:', e.message, '\n'); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
