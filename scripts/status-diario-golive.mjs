// ─────────────────────────────────────────────────────────────────────────────
// STATUS DIÁRIO do go-live — vigília da primeira semana. SOMENTE LEITURA.
//   node --env-file=.env --env-file=<prod-asaas-key> scripts/status-diario-golive.mjs
// Reporta: leads/trials/pagantes do dia, cobranças, e a SAÚDE DO WEBHOOK
// (⚠️ 15 falhas consecutivas pausam a fila inteira no Asaas).
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from '@/lib/prisma.ts'

const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
if (!host.includes('ep-lively-firefly')) { console.error('❌ não é produção — abortando'); process.exit(1) }
const q = (sql, ...p) => prisma.$queryRawUnsafe(sql, ...p)
const HOJE = `("createdAt" AT TIME ZONE 'America/Sao_Paulo')::date = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date`

const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
console.log(`\n═══════ STATUS GO-LIVE — ${agora} ═══════\n`)

// 1) Funil de hoje (contas Asaas)
const [funil] = await q(`
  SELECT
    COUNT(*) FILTER (WHERE "assinaturaStatus"='AGUARDANDO_PAGAMENTO' AND ${HOJE})::int leads_hoje,
    COUNT(*) FILTER (WHERE "assinaturaStatus"='TRIAL'                AND ${HOJE})::int trials_hoje,
    COUNT(*) FILTER (WHERE "assinaturaStatus"='ATIVA'                AND ${HOJE})::int ativas_hoje,
    COUNT(*) FILTER (WHERE "assinaturaStatus"='AGUARDANDO_PAGAMENTO')::int leads_total,
    COUNT(*) FILTER (WHERE "assinaturaStatus"='TRIAL')::int trials_total,
    COUNT(*) FILTER (WHERE "assinaturaStatus"='ATIVA')::int ativas_total
  FROM "Workspace" WHERE "assinaturaOrigem"='asaas'`)
console.log('[Funil]')
console.log(`  HOJE:  leads ${funil.leads_hoje} · trials ${funil.trials_hoje} · pagantes ${funil.ativas_hoje}`)
console.log(`  TOTAL: leads ${funil.leads_total} · trials ${funil.trials_total} · pagantes ${funil.ativas_total}`)

// 2) Cobranças de hoje
const cobs = await q(`SELECT "status", COUNT(*)::int n, SUM("valor")::float v FROM "AsaasCobranca" WHERE ${HOJE} GROUP BY "status" ORDER BY n DESC`)
console.log('\n[Cobranças hoje]')
console.log(cobs.length ? cobs.map(c => `  ${c.status}: ${c.n} (R$ ${c.v?.toFixed(2)})`).join('\n') : '  (nenhuma)')

// 3) Saúde do webhook — o item crítico
const [wh] = await q(`
  SELECT COUNT(*) FILTER (WHERE ${HOJE})::int hoje,
         COUNT(*) FILTER (WHERE ${HOJE} AND "erro" IS NOT NULL)::int erros_hoje,
         COUNT(*) FILTER (WHERE ${HOJE} AND "processadoEm" IS NULL AND "erro" IS NULL)::int pendentes
  FROM "AsaasWebhookEvento"`)
// falhas CONSECUTIVAS recentes (o que pausa a fila em 15)
const ult = await q(`SELECT "erro" IS NOT NULL falhou FROM "AsaasWebhookEvento" ORDER BY "createdAt" DESC LIMIT 15`)
let consec = 0; for (const e of ult) { if (e.falhou) consec++; else break }
console.log('\n[Webhook]')
console.log(`  eventos hoje: ${wh.hoje} · com erro: ${wh.erros_hoje} · não processados: ${wh.pendentes}`)
console.log(`  falhas consecutivas (últimos eventos): ${consec}/15 ${consec >= 10 ? '🔴 PERTO DE PAUSAR A FILA' : consec > 0 ? '🟡 atenção' : '✅'}`)
if (wh.erros_hoje > 0) {
  const ex = await q(`SELECT "evento", LEFT("erro",80) erro, TO_CHAR("createdAt",'HH24:MI') t FROM "AsaasWebhookEvento" WHERE ${HOJE} AND "erro" IS NOT NULL ORDER BY "createdAt" DESC LIMIT 5`)
  console.log('  erros recentes:'); for (const e of ex) console.log(`    ${e.t} ${e.evento}: ${e.erro}`)
}

// 4) Avisos internos que saíram hoje
const [avi] = await q(`SELECT COUNT(*) FILTER (WHERE "tipo" LIKE 'INTERNO_%' AND ${HOJE} AND "enviadoEm" IS NOT NULL)::int enviados FROM "AssinaturaAviso"`)
console.log(`\n[Avisos internos enviados hoje] ${avi.enviados}`)

const alerta = consec >= 10 || wh.pendentes > 0
console.log(`\n${alerta ? '🔴 REQUER ATENÇÃO (ver acima)' : '✅ tudo normal'}\n`)
await prisma.$disconnect()
