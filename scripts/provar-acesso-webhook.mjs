// ─────────────────────────────────────────────────────────────────────────────
// PROVA da Etapa 4 — a cobrança mexe no ACESSO e gera a comissão.
//
// Dispara eventos sintéticos no webhook do preview e confere o efeito no
// Workspace e em ParceiroComissao. Não depende de pagamento real.
//
// USO:
//   PREVIEW_URL=https://<preview>.vercel.app \
//   node --env-file=.env --env-file=.env.local scripts/provar-acesso-webhook.mjs
//
// ⚠️ Cria e apaga dados "wsteste_". Aborta se o banco for produção.
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'
import crypto from 'node:crypto'

const prisma = new PrismaClient()
const BASE = (process.env.PREVIEW_URL || '').replace(/\/+$/, '')
const BYPASS = (process.env.VERCEL_BYPASS_SECRET || '').trim()
const TOKEN = (process.env.WEBHOOK_TOKEN_PREVIEW || '').trim()

let falhas = 0
const checar = (n, ok, d = '') => { if (!ok) falhas++; console.log(`  ${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`) }
const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const marca = Date.now().toString(36)

async function evento(sub, pay, tipo, dueDate, valor = 29.9) {
  const r = await fetch(`${BASE}/api/webhooks/asaas?x-vercel-protection-bypass=${BYPASS}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'asaas-access-token': TOKEN },
    body: JSON.stringify({
      id: 'evt_teste_' + crypto.randomBytes(8).toString('hex'),
      event: tipo,
      payment: {
        id: pay, subscription: sub, customer: 'cus_teste', value: valor,
        netValue: Math.round((valor - 0.99) * 100) / 100,
        status: tipo.replace('PAYMENT_', ''), billingType: 'CREDIT_CARD', dueDate,
      },
    }),
  })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

const ws = (k) => `wsteste_${k}_${marca}`

async function cenario(k, { origem = 'asaas', comSplit = false, semParceiro = false, splitErro = null } = {}) {
  const id = ws(k)
  const sub = 'sub_teste_' + k + '_' + marca
  const parceiroId = semParceiro ? null : `ptest_${k}_${marca}`
  const ontem = new Date(); ontem.setDate(ontem.getDate() - 1)

  await prisma.$executeRawUnsafe(
    `INSERT INTO "Workspace" ("id","nome","slug","plano","ativo","assinaturaStatus","assinaturaOrigem")
     VALUES ($1,$2,$3,'TRIAL',true,'TRIAL',$4)`, id, 'T ' + k, id, origem)
  if (parceiroId) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Parceiro" ("id","tipo","nome","ativo","comissaoPercMensal","comissaoPercAnual","comissaoRecorrente","walletId","createdAt")
       VALUES ($1,'influencer',$2,true,30,40,true,$3,NOW())`, parceiroId, 'P ' + k, comSplit ? 'wallet-fake-' + k : null)
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Lead" ("id","nome","telefone","email","origem","consentimento","parceiroId","status","workspaceId","createdAt")
       VALUES ($1,'L','','x@y.z','parceiro',true,$2,'trial',$3,NOW())`, gerarId(), parceiroId, id)
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "AsaasAssinatura" ("id","workspaceId","subscriptionId","sandbox","ciclo","valor","status","proximoVencimento","parceiroId","splitWalletId","splitValor","splitPercentual","splitErro","createdAt","updatedAt")
     VALUES ($1,$2,$3,true,'MONTHLY',29.90,'ACTIVE',$4,$5,$6,$7,$8,$9,NOW(),NOW())`,
    gerarId(), id, sub, ontem, parceiroId,
    comSplit ? 'wallet-fake-' + k : null, comSplit ? 8.97 : null, comSplit ? 30 : null, splitErro)
  return { id, sub, parceiroId }
}

const lerWs = async (id) => (await prisma.$queryRawUnsafe(
  `SELECT "assinaturaStatus","ativo","assinaturaExpira" FROM "Workspace" WHERE "id" = $1`, id))[0]
const lerCom = async (ref) => (await prisma.$queryRawUnsafe(
  `SELECT "status","valor"::float AS valor,"percentual"::float AS perc FROM "ParceiroComissao" WHERE "referencia" = $1`, ref))[0]

async function main() {
  console.log('\n=== PROVA — Etapa 4: cobrança → acesso → comissão ===\n')
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
  console.log(`Banco:   ${host}\nPreview: ${BASE}\n`)
  if (!BASE || !TOKEN) { console.error('❌ Falta PREVIEW_URL/WEBHOOK_TOKEN_PREVIEW\n'); process.exitCode = 1; return }
  if (host.includes('ep-lively-firefly')) { console.error('❌ PRODUÇÃO\n'); process.exitCode = 1; return }

  const hoje = new Date().toISOString().slice(0, 10)

  try {
    // [1] pagamento confirmado → ATIVA + comissão paga via split
    console.log('[1] PAYMENT_RECEIVED com split → ATIVA + comissão pago_via_split')
    const c1 = await cenario('pago', { comSplit: true })
    const pay1 = 'pay_teste_pago_' + marca
    const r1 = await evento(c1.sub, pay1, 'PAYMENT_RECEIVED', hoje)
    checar('webhook 200', r1.status === 200 && r1.body.processado === true, JSON.stringify(r1.body))
    const w1 = await lerWs(c1.id)
    checar('status ATIVA', w1?.assinaturaStatus === 'ATIVA', w1?.assinaturaStatus)
    checar('ativo=true', w1?.ativo === true)
    const k1 = await lerCom(pay1)
    checar('comissão pago_via_split', k1?.status === 'pago_via_split', k1?.status)
    checar('valor do snapshot (8.97)', k1?.valor === 8.97, String(k1?.valor))

    // [2] parceiro sem wallet → comissão pendente
    console.log('\n[2] PAYMENT_RECEIVED sem wallet → comissão pendente')
    const c2 = await cenario('semwallet', { comSplit: false })
    const pay2 = 'pay_teste_semw_' + marca
    await evento(c2.sub, pay2, 'PAYMENT_RECEIVED', hoje)
    const k2 = await lerCom(pay2)
    checar('comissão pendente', k2?.status === 'pendente', k2?.status)
    checar('valor 0 (nada foi pago ainda)', k2?.valor === 0, String(k2?.valor))

    // [3] split recusado → pendente, e o motivo foi preservado
    console.log('\n[3] Split recusado pelo Asaas → pendente com a causa registrada')
    const c3 = await cenario('recusado', { comSplit: false, splitErro: 'Não é permitido split para sua própria carteira.' })
    const pay3 = 'pay_teste_rec_' + marca
    await evento(c3.sub, pay3, 'PAYMENT_RECEIVED', hoje)
    const k3 = await lerCom(pay3)
    checar('comissão pendente', k3?.status === 'pendente', k3?.status)
    const [a3] = await prisma.$queryRawUnsafe(
      `SELECT "splitErro" FROM "AsaasAssinatura" WHERE "subscriptionId" = $1`, c3.sub)
    checar('motivo da recusa guardado', !!a3?.splitErro, a3?.splitErro)

    // [4] vencido → INADIMPLENTE, sem cortar
    console.log('\n[4] PAYMENT_OVERDUE → INADIMPLENTE (NÃO corta — quem corta é o job)')
    const c4 = await cenario('vencido', { semParceiro: true })
    await evento(c4.sub, 'pay_teste_venc_' + marca, 'PAYMENT_OVERDUE', hoje)
    const w4 = await lerWs(c4.id)
    checar('status INADIMPLENTE', w4?.assinaturaStatus === 'INADIMPLENTE', w4?.assinaturaStatus)
    checar('ativo continua true (carência)', w4?.ativo === true)

    // [5] HOTMART não é tocada
    console.log('\n[5] Workspace HOTMART → webhook Asaas NÃO a toca')
    const c5 = await cenario('hotmart', { origem: 'hotmart', semParceiro: true })
    await evento(c5.sub, 'pay_teste_hot_' + marca, 'PAYMENT_RECEIVED', hoje)
    const w5 = await lerWs(c5.id)
    checar('status continua TRIAL (intocado)', w5?.assinaturaStatus === 'TRIAL', w5?.assinaturaStatus)

    // [6] estorno → volta a INADIMPLENTE e cancela a comissão
    console.log('\n[6] PAYMENT_REFUNDED → INADIMPLENTE + comissão cancelada')
    const c6 = await cenario('estorno', { comSplit: true })
    const pay6 = 'pay_teste_est_' + marca
    await evento(c6.sub, pay6, 'PAYMENT_RECEIVED', hoje)
    checar('antes: ATIVA', (await lerWs(c6.id))?.assinaturaStatus === 'ATIVA')
    checar('antes: comissão paga', (await lerCom(pay6))?.status === 'pago_via_split')
    await evento(c6.sub, pay6, 'PAYMENT_REFUNDED', hoje)
    checar('depois: INADIMPLENTE', (await lerWs(c6.id))?.assinaturaStatus === 'INADIMPLENTE')
    checar('depois: comissão cancelada', (await lerCom(pay6))?.status === 'cancelado')

    // [7] idempotência do accrual
    console.log('\n[7] Reprocessar o mesmo pagamento não duplica comissão')
    const c7 = await cenario('idem', { comSplit: true })
    const pay7 = 'pay_teste_idem_' + marca
    await evento(c7.sub, pay7, 'PAYMENT_RECEIVED', hoje)
    await evento(c7.sub, pay7, 'PAYMENT_CONFIRMED', hoje)   // outro eventoId, mesmo pagamento
    const [{ n }] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS n FROM "ParceiroComissao" WHERE "referencia" = $1`, pay7)
    checar('exatamente 1 comissão', n === 1, `linhas: ${n}`)

  } finally {
    console.log('\n[limpeza]')
    await prisma.$executeRawUnsafe(`DELETE FROM "ParceiroComissao" WHERE "workspaceId" LIKE 'wsteste_%'`)
    await prisma.$executeRawUnsafe(`DELETE FROM "AsaasWebhookEvento" WHERE "eventoId" LIKE 'evt_teste_%'`)
    await prisma.$executeRawUnsafe(`DELETE FROM "AsaasCobranca" WHERE "paymentId" LIKE 'pay_teste_%'`)
    await prisma.$executeRawUnsafe(`DELETE FROM "AsaasAssinatura" WHERE "workspaceId" LIKE 'wsteste_%'`)
    await prisma.$executeRawUnsafe(`DELETE FROM "Lead" WHERE "workspaceId" LIKE 'wsteste_%'`)
    await prisma.$executeRawUnsafe(`DELETE FROM "Parceiro" WHERE "id" LIKE 'ptest_%'`)
    await prisma.$executeRawUnsafe(`DELETE FROM "Workspace" WHERE "id" LIKE 'wsteste_%'`)
    console.log('  🧹 limpo')
  }

  console.log(`\n${falhas === 0 ? '✅ TODAS as provas passaram' : `❌ ${falhas} falha(s)`}\n`)
  process.exitCode = falhas === 0 ? 0 : 1
}

main().catch(e => { console.error('\n❌ Erro:', e.message, '\n'); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
