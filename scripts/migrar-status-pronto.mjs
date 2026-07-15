// ─────────────────────────────────────────────────────────────────────────────
// Migração de STATUS DO PEDIDO (Order.status) — CIENTE DE EXPEDIÇÃO.
//
//   (i-a) Workspace COM expedição:  Order.status 'CONCLUIDO' → 'ENVIADO'
//         (o antigo "finalizado" era, na prática, entregue — preserva a métrica).
//   (i-b) Workspace SEM expedição:  Order.status 'CONCLUIDO' → 'PRONTO'
//         (PRONTO é o estado final da artesã = entregue).
//   (ii)  Backfill do bug A:  Order.status 'EM_PRODUCAO' cujo SETOR ATUAL é a EXPEDIÇÃO
//         → 'PRONTO' (produção terminada, aguardando expedir).
//
// "COM expedição" = existe SetorConfig ativo com ehExpedicao=true, OU (na ausência de
// qualquer marcação) um setor com "expedi" no nome — MESMA regra do app (lib/statusPedido).
//
// ⚠️ ESCOPO ESTRITO — NÃO toca:
//   - Order.status = 'ENVIADO' já existente, nem 'CANCELADO'
//   - PedidoSetor.status = 'CONCLUIDO' (status de SETOR — outro domínio)
//   - SuporteFeedback.status = 'CONCLUIDO' (outro domínio)
//   - pedidos EM_PRODUCAO que NÃO estão na expedição
//
// USO:
//   node --env-file=.env scripts/migrar-status-pronto.mjs           # DRY-RUN (só leitura)
//   node --env-file=.env scripts/migrar-status-pronto.mjs --apply   # aplica (transação + log)
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient, Prisma } from '@prisma/client'
import { writeFileSync } from 'node:fs'

const prisma = new PrismaClient()
const APLICAR = process.argv.includes('--apply')

// Um workspace "tem expedição" se tem setor ehExpedicao=true, ou (sem nenhum marcado) um
// setor com "expedi" no nome. Espelha lib/statusPedido.workspaceTemExpedicao.
const WS_TEM_EXPEDICAO = Prisma.sql`
  EXISTS (
    SELECT 1 FROM "SetorConfig" s
    WHERE s."workspaceId" = o."workspaceId" AND s."ativo" = true
      AND (
        s."ehExpedicao" = true
        OR (
          s."nome" ILIKE '%expedi%'
          AND NOT EXISTS (
            SELECT 1 FROM "SetorConfig" x
            WHERE x."workspaceId" = o."workspaceId" AND x."ativo" = true AND x."ehExpedicao" = true
          )
        )
      )
  )
`

function ts() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

async function main() {
  console.log(`\n=== Migração status → PRONTO/ENVIADO  (${APLICAR ? 'APLICAR' : 'DRY-RUN'}) ===\n`)

  // (i-a) CONCLUIDO em workspace COM expedição → ENVIADO
  const conclComExp = await prisma.$queryRaw`
    SELECT o."id", o."workspaceId", o."numero"
    FROM "Order" o
    WHERE o."status" = 'CONCLUIDO' AND ${WS_TEM_EXPEDICAO}
  `
  // (i-b) CONCLUIDO em workspace SEM expedição → PRONTO
  const conclSemExp = await prisma.$queryRaw`
    SELECT o."id", o."workspaceId", o."numero"
    FROM "Order" o
    WHERE o."status" = 'CONCLUIDO' AND NOT ${WS_TEM_EXPEDICAO}
  `
  // (ii) EM_PRODUCAO cujo SETOR ATUAL é a EXPEDIÇÃO → PRONTO
  const backfillRows = await prisma.$queryRaw`
    SELECT DISTINCT o."id", o."workspaceId", o."numero"
    FROM "Order" o
    JOIN "PedidoSetor" ps ON ps."pedidoId" = o."id" AND ps."status" = 'EM_ANDAMENTO'
    JOIN "SetorConfig" sc ON sc."id" = ps."setorId"
    WHERE o."status" = 'EM_PRODUCAO'
      AND (
        sc."ehExpedicao" = true
        OR (
          sc."nome" ILIKE '%expedi%'
          AND NOT EXISTS (
            SELECT 1 FROM "SetorConfig" x
            WHERE x."workspaceId" = o."workspaceId" AND x."ativo" = true AND x."ehExpedicao" = true
          )
        )
      )
  `
  const idsComExp   = [...new Set(conclComExp.map((r) => r.id))]
  const idsSemExp   = [...new Set(conclSemExp.map((r) => r.id))]
  const idsBackfill = [...new Set(backfillRows.map((r) => r.id))]

  const porWs = (rows) => {
    const m = {}
    for (const r of rows) m[r.workspaceId] = (m[r.workspaceId] || 0) + 1
    return m
  }
  const resumo = (titulo, rows) => {
    const m = porWs(rows)
    console.log(`${titulo}`)
    console.log(`   total: ${rows.length} pedido(s) em ${Object.keys(m).length} workspace(s)`)
    for (const [ws, n] of Object.entries(m).sort((a, b) => b[1] - a[1])) console.log(`     - ws ${ws}: ${n}`)
  }

  resumo(`(i-a) CONCLUIDO (workspace COM expedição) → ENVIADO`, conclComExp)
  console.log('')
  resumo(`(i-b) CONCLUIDO (workspace SEM expedição) → PRONTO`, conclSemExp)
  console.log('')
  resumo(`(ii)  EM_PRODUCAO na EXPEDIÇÃO → PRONTO (backfill bug A)`, backfillRows)

  if (!APLICAR) {
    console.log(`\nDRY-RUN — NADA foi alterado. Revise os números e rode com --apply para aplicar.\n`)
    await prisma.$disconnect()
    return
  }

  // ── Aplicação (transação) + log de auditoria (reversível) ────────────────
  const stamp = ts()
  const log = {
    quando: new Date().toISOString(),
    i_a_concluido_com_expedicao_para_ENVIADO: conclComExp,
    i_b_concluido_sem_expedicao_para_PRONTO: conclSemExp,
    ii_emproducao_expedicao_para_PRONTO: backfillRows,
  }
  const logPath = `scripts/migracao-pronto-${stamp}.json`
  writeFileSync(logPath, JSON.stringify(log, null, 2))
  console.log(`\nLog de auditoria (para reversão): ${logPath}`)

  const ops = []
  if (idsComExp.length)
    ops.push(prisma.$executeRaw`UPDATE "Order" SET status='ENVIADO', "updatedAt"=NOW() WHERE status='CONCLUIDO' AND id IN (${Prisma.join(idsComExp)})`)
  if (idsSemExp.length)
    ops.push(prisma.$executeRaw`UPDATE "Order" SET status='PRONTO', "updatedAt"=NOW() WHERE status='CONCLUIDO' AND id IN (${Prisma.join(idsSemExp)})`)
  if (idsBackfill.length)
    ops.push(prisma.$executeRaw`UPDATE "Order" SET status='PRONTO', "updatedAt"=NOW() WHERE status='EM_PRODUCAO' AND id IN (${Prisma.join(idsBackfill)})`)

  const res = ops.length ? await prisma.$transaction(ops) : []
  console.log(`\n✅ Aplicado:`)
  console.log(`   (i-a) CONCLUIDO→ENVIADO : ${idsComExp.length} pedido(s)`)
  console.log(`   (i-b) CONCLUIDO→PRONTO  : ${idsSemExp.length} pedido(s)`)
  console.log(`   (ii)  EM_PRODUCAO→PRONTO: ${idsBackfill.length} pedido(s)`)

  const [{ n }] = await prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM "Order" WHERE status = 'CONCLUIDO'`
  console.log(`\nConferência: Order.status = 'CONCLUIDO' restantes = ${n} (esperado 0)\n`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ERRO na migração:', e)
  await prisma.$disconnect()
  process.exit(1)
})
