// ─────────────────────────────────────────────────────────────────────────────
// PROVA — Parceiras: split no funil vivo (dev real + sandbox Asaas real).
// Exercita as funções REAIS (resolverSplitParceira, criarCobranca, aplicarEvento)
// contra o branch Neon dev e o sandbox do Asaas. Semeia parceiro à mão, limpa ao fim.
//
//   PARCEIRAS_ATIVO=on node --experimental-strip-types --import ./scripts/_loader-alias.mjs \
//     --env-file=.env --env-file=.env.local scripts/provar-parceiras-split.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from '../lib/prisma.ts'
import { resolverSplitParceira } from '../lib/parceiras/split.ts'
import { criarCobranca, garantirCliente } from '../lib/pagamento/asaas/index.ts'
import { chamarAsaas } from '../lib/pagamento/asaas/client.ts'
import { aplicarEvento } from '../lib/pagamento/asaas/webhook.ts'
import { getPlano } from '../lib/assinatura/planos.ts'
import crypto from 'node:crypto'

const WALLET = (process.env.ASAAS_WALLET_TESTE || '').trim()
let falhas = 0
const marca = Date.now().toString(36)
const checar = (n, ok, d = '') => { if (!ok) falhas++; console.log(`  ${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`) }
const ids = { ws: [], parc: [], cust: [], sub: [] }

async function semearParceiro(comWallet) {
  const suf = `${comWallet ? 'w' : 'x'}_${marca}` // único por parceiro (w/x difere)
  const id = `ptest_parc_${suf}`
  ids.parc.push(id)
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Parceiro" ("id","tipo","nome","ativo","comissaoPercMensal","comissaoPercAnual","comissaoRecorrente","walletId","cupom","linkSlug","createdAt")
     VALUES ($1,'influencer',$2,true,30,40,true,$3,$4,$5,NOW())`,
    id, 'Parceira ' + suf, comWallet ? WALLET : null, 'CUP' + suf, 'slug-' + suf)
  return id
}
async function semearWorkspaceComAtribuicao(parceiroId) {
  const ws = `wsteste_parc_${marca}_${Math.random().toString(36).slice(2, 6)}`
  ids.ws.push(ws)
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Workspace" ("id","nome","slug","plano","ativo","assinaturaStatus","assinaturaOrigem")
     VALUES ($1,$2,$1,'TRIAL',true,'AGUARDANDO_PAGAMENTO','asaas')`, ws, 'Ateliê ' + ws.slice(-4))
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Lead" ("id","nome","telefone","email","origem","consentimento","parceiroId","tipoAtribuicao","status","workspaceId","createdAt")
     VALUES ($1,'Indicada','','ind@teste.local','parceira',true,$2,'cupom','cadastrou',$3,NOW())`,
    'lead_' + ws, parceiroId, ws)
  return ws
}
const evento = (payment) => aplicarEvento({ id: 'evt_' + crypto.randomBytes(6).toString('hex'), event: 'PAYMENT_RECEIVED', payment })

async function main() {
  console.log('\n=== PROVA — PARCEIRAS: split no funil vivo ===\n')
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
  console.log(`Banco: ${host} | PARCEIRAS_ATIVO=${process.env.PARCEIRAS_ATIVO}\n`)
  if (host.includes('ep-lively-firefly')) { console.error('❌ PRODUÇÃO'); process.exit(1) }
  if (!WALLET) { console.error('❌ falta ASAAS_WALLET_TESTE'); process.exit(1) }

  try {
    const plano = getPlano('mensal')

    // ── [3] PIX: split na cobrança + snapshot + accrual pago_via_split
    console.log('[3] Pix: split na cobrança (com walletId) → accrual pago_via_split')
    const pW = await semearParceiro(true)
    const wsW = await semearWorkspaceComAtribuicao(pW)
    const sp = await resolverSplitParceira(wsW, plano, 29.90, 'avista')
    checar('resolveu split (walletId+valor)', sp.split.length === 1 && sp.splitValor === 8.97 && sp.parceiroId === pW, `valor=${sp.splitValor} perc=${sp.splitPercentual}`)
    const cli = await garantirCliente(wsW, { name: 'Indicada', cpfCnpj: '24971563792' }); ids.cust.push(cli.dados?.customerId)
    const cob = await criarCobranca({ workspaceId: wsW, customerId: cli.dados.customerId, valor: 29.90, vencimento: '2026-09-06', forma: 'PIX',
      referencia: wsW, finalidade: 'assinatura', split: sp.split, parceiroId: sp.parceiroId, splitWalletId: sp.splitWalletId, splitValor: sp.splitValor, splitPercentual: sp.splitPercentual, splitErro: sp.splitErro })
    const [snap] = await prisma.$queryRawUnsafe(`SELECT "parceiroId","splitWalletId","splitValor"::float v FROM "AsaasCobranca" WHERE "paymentId"=$1`, cob.dados.paymentId)
    checar('snapshot do split na AsaasCobranca', snap?.parceiroId === pW && snap?.splitWalletId === WALLET && snap?.v === 8.97)
    await evento({ id: cob.dados.paymentId, value: 29.90, netValue: 28.91, status: 'RECEIVED', billingType: 'PIX', externalReference: wsW })
    const [ac] = await prisma.$queryRawUnsafe(`SELECT "status","valor"::float v FROM "ParceiroComissao" WHERE "referencia"=$1`, cob.dados.paymentId)
    checar('accrual pago_via_split R$8,97', ac?.status === 'pago_via_split' && ac?.v === 8.97, `${ac?.status} ${ac?.v}`)

    // ── [4] PIX recorrência: nova cobrança carrega split de novo → novo accrual
    console.log('\n[4] Pix recorrência: 2ª cobrança carrega split → novo accrual')
    const sp2 = await resolverSplitParceira(wsW, plano, 29.90, 'avista')
    const cob2 = await criarCobranca({ workspaceId: wsW, customerId: cli.dados.customerId, valor: 29.90, vencimento: '2026-10-06', forma: 'PIX',
      referencia: wsW, finalidade: 'assinatura', split: sp2.split, parceiroId: sp2.parceiroId, splitWalletId: sp2.splitWalletId, splitValor: sp2.splitValor, splitPercentual: sp2.splitPercentual })
    checar('2ª cobrança tem split (renovação resolve igual)', sp2.split.length === 1)
    await evento({ id: cob2.dados.paymentId, value: 29.90, netValue: 28.91, status: 'RECEIVED', billingType: 'PIX', externalReference: wsW })
    const [ac2] = await prisma.$queryRawUnsafe(`SELECT "status" FROM "ParceiroComissao" WHERE "referencia"=$1`, cob2.dados.paymentId)
    const [{ n: totAc }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int n FROM "ParceiroComissao" WHERE "workspaceId"=$1`, wsW)
    checar('2º accrual criado (2 no total → recorrência)', ac2?.status === 'pago_via_split' && totAc === 2, `total=${totAc}`)

    // ── [1]+[2] CARTÃO: AsaasAssinatura no 1º PAYMENT_RECEIVED + recorrência
    console.log('\n[1]+[2] Cartão: AsaasAssinatura no 1º PAYMENT_RECEIVED (snapshot do payload) + 2º ciclo')
    // simula a subscription que o checkout hospedado geraria (com split), no sandbox
    const sub = await chamarAsaas('/subscriptions', { metodo: 'POST', exigirAtivo: false, corpo: {
      customer: cli.dados.customerId, billingType: 'CREDIT_CARD', value: 29.90, nextDueDate: '2026-09-06', cycle: 'MONTHLY',
      externalReference: wsW, split: [{ walletId: WALLET, fixedValue: 8.97 }] } })
    ids.sub.push(sub.dados?.id)
    const payCartao = 'pay_cartao1_' + marca
    await evento({ id: payCartao, subscription: sub.dados.id, customer: cli.dados.customerId, value: 29.90, netValue: 28.91,
      status: 'RECEIVED', billingType: 'CREDIT_CARD', dueDate: '2026-09-06', externalReference: wsW,
      split: [{ walletId: WALLET, fixedValue: 8.97, status: 'PENDING' }] })
    const [assC] = await prisma.$queryRawUnsafe(`SELECT "parceiroId","splitWalletId","splitValor"::float v FROM "AsaasAssinatura" WHERE "subscriptionId"=$1`, sub.dados.id)
    checar('AsaasAssinatura criada com split fotografado do payload', assC?.parceiroId === pW && assC?.splitWalletId === WALLET && assC?.v === 8.97)
    const [acC] = await prisma.$queryRawUnsafe(`SELECT "status" FROM "ParceiroComissao" WHERE "referencia"=$1`, payCartao)
    checar('accrual do cartão pago_via_split', acC?.status === 'pago_via_split')
    // recorrência: PUT garantiu split na subscription → 2º pagamento ainda tem split
    const subGet = await chamarAsaas(`/subscriptions/${sub.dados.id}`, { exigirAtivo: false })
    checar('split VIVE na subscription (recorrência garantida via PUT)', Array.isArray(subGet.dados?.split) && subGet.dados.split[0]?.walletId === WALLET)
    const payCartao2 = 'pay_cartao2_' + marca
    await evento({ id: payCartao2, subscription: sub.dados.id, customer: cli.dados.customerId, value: 29.90, netValue: 28.91,
      status: 'RECEIVED', billingType: 'CREDIT_CARD', dueDate: '2026-10-06', externalReference: wsW,
      split: [{ walletId: WALLET, fixedValue: 8.97, status: 'PENDING' }] })
    const [acC2] = await prisma.$queryRawUnsafe(`SELECT "status" FROM "ParceiroComissao" WHERE "referencia"=$1`, payCartao2)
    checar('2º ciclo do cartão → novo accrual', acC2?.status === 'pago_via_split')

    // ── [5] FALLBACK: parceiro SEM walletId → cobrança segue, accrual pendente
    console.log('\n[5] Fallback: parceiro SEM walletId → receita segue, accrual pendente')
    const pX = await semearParceiro(false)
    const wsX = await semearWorkspaceComAtribuicao(pX)
    const spX = await resolverSplitParceira(wsX, plano, 29.90, 'avista')
    checar('sem walletId → split vazio mas parceiroId presente', spX.split.length === 0 && spX.parceiroId === pX)
    const cliX = await garantirCliente(wsX, { name: 'Ind', cpfCnpj: '24971563792' }); ids.cust.push(cliX.dados?.customerId)
    const cobX = await criarCobranca({ workspaceId: wsX, customerId: cliX.dados.customerId, valor: 29.90, vencimento: '2026-09-06', forma: 'PIX',
      referencia: wsX, finalidade: 'assinatura', split: spX.split, parceiroId: spX.parceiroId, splitWalletId: spX.splitWalletId, splitValor: spX.splitValor, splitPercentual: spX.splitPercentual, splitErro: spX.splitErro })
    checar('cobrança criada mesmo sem split (receita não some)', cobX.ok)
    await evento({ id: cobX.dados.paymentId, value: 29.90, netValue: 28.91, status: 'RECEIVED', billingType: 'PIX', externalReference: wsX })
    const [acX] = await prisma.$queryRawUnsafe(`SELECT "status" FROM "ParceiroComissao" WHERE "referencia"=$1`, cobX.dados.paymentId)
    checar('accrual pendente (repasse manual)', acX?.status === 'pendente', acX?.status)

    // ── [7] FLAG OFF: resolução não injeta nada
    console.log('\n[7] Flag OFF: split não é resolvido (funil idêntico ao de hoje)')
    process.env.PARCEIRAS_ATIVO = 'off'
    const spOff = await resolverSplitParceira(wsW, plano, 29.90, 'avista')
    checar('com PARCEIRAS_ATIVO off → split vazio, sem parceiroId', spOff.split.length === 0 && spOff.parceiroId === null)
    process.env.PARCEIRAS_ATIVO = 'on'

  } finally {
    console.log('\n[limpeza dev]')
    for (const ws of ids.ws) {
      for (const t of ['ParceiroComissao', 'AsaasCobranca', 'AsaasAssinatura', 'AsaasCliente', 'Lead'])
        await prisma.$executeRawUnsafe(`DELETE FROM "${t}" WHERE "workspaceId"=$1`, ws).catch(() => {})
      await prisma.$executeRawUnsafe(`DELETE FROM "Workspace" WHERE "id"=$1`, ws).catch(() => {})
    }
    for (const p of ids.parc) {
      await prisma.$executeRawUnsafe(`DELETE FROM "ParceiroComissao" WHERE "parceiroId"=$1`, p).catch(() => {})
      await prisma.$executeRawUnsafe(`DELETE FROM "Lead" WHERE "parceiroId"=$1`, p).catch(() => {})
      await prisma.$executeRawUnsafe(`DELETE FROM "Parceiro" WHERE "id"=$1`, p).catch(() => {})
    }
    console.log('  🧹 limpo (assinaturas de teste seguem no sandbox Asaas)')
  }

  console.log(`\n${falhas === 0 ? '✅ PARCEIRAS SPLIT PASSOU' : `❌ ${falhas} falha(s)`}\n`)
  process.exit(falhas === 0 ? 0 : 1)
}
main().catch(e => { console.error('\n❌ Erro:', e.message, e.stack, '\n'); process.exit(1) })
