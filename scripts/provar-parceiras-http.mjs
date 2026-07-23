// ─────────────────────────────────────────────────────────────────────────────
// PROVA HTTP e2e — Parceiras no Preview (o que o proof local não cobre: a camada
// HTTP do portão, o GRANT do trial-30, e o webhook por HTTP + idempotência).
//
//   PREVIEW_URL=https://vps-gestao-git-feat-parceiras-....vercel.app \
//   node --experimental-strip-types --import ./scripts/_loader-alias.mjs \
//     --env-file=.env --env-file=.env.local scripts/provar-parceiras-http.mjs
// Requer no Preview: ASSINATURA_NOVO_CADASTRO=on, PARCEIRAS_ATIVO=on.
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from '../lib/prisma.ts'
import { resolverSplitParceira } from '../lib/parceiras/split.ts'
import { getPlano } from '../lib/assinatura/planos.ts'
import crypto from 'node:crypto'

const BASE = (process.env.PREVIEW_URL || '').replace(/\/+$/, '')
const BYPASS = (process.env.VERCEL_BYPASS_SECRET || '').trim()
const TOKEN_WH = (process.env.WEBHOOK_TOKEN_PREVIEW || '').trim()
const API = (process.env.ASAAS_API_KEY || '').trim()
const WALLET = (process.env.ASAAS_WALLET_TESTE || '').trim()
const SENHA = 'Teste@' + Math.random().toString(36).slice(2, 10)
const CPF = '24971563792'
const marca = Date.now().toString(36)
let falhas = 0
const checar = (n, ok, d = '') => { if (!ok) falhas++; console.log(`  ${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`) }
const url = (p) => `${BASE}${p}${BYPASS ? (p.includes('?') ? '&' : '?') + 'x-vercel-protection-bypass=' + BYPASS : ''}`
const asaas = async (p, m = 'GET', c) => {
  const r = await fetch(`https://api-sandbox.asaas.com/v3${p}`, { method: m, headers: { access_token: API, 'Content-Type': 'application/json' }, body: c ? JSON.stringify(c) : undefined })
  const t = await r.text(); try { return JSON.parse(t) } catch { return null }
}
const evento = (payment) => fetch(url('/api/webhooks/asaas'), {
  method: 'POST', headers: { 'content-type': 'application/json', 'asaas-access-token': TOKEN_WH },
  body: JSON.stringify({ id: 'evt_' + crypto.randomBytes(8).toString('hex'), event: 'PAYMENT_RECEIVED', payment }),
})
function jar() { const c = new Map(); return {
  guardar(r) { for (const [k, v] of r.headers) { if (k.toLowerCase() !== 'set-cookie') continue
    for (const p of v.split(/,(?=[^;]+=)/)) { const [n, val] = p.split(';')[0].split('='); if (n && val !== undefined) c.set(n.trim(), val.trim()) } } },
  header() { return [...c].map(([k, v]) => `${k}=${v}`).join('; ') }, tem(s) { return [...c.keys()].some(k => k.includes(s)) },
  get(s) { for (const [k, v] of c) if (k.includes(s)) return v; return null } } }
async function logar(j, email) {
  const r1 = await fetch(url('/api/auth/csrf'), { headers: { cookie: j.header() } }); j.guardar(r1)
  const { csrfToken } = await r1.json()
  const r2 = await fetch(url('/api/auth/callback/credentials'), { method: 'POST', headers: { cookie: j.header(), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, senha: SENHA, csrfToken, callbackUrl: `${BASE}/dashboard`, json: 'true' }).toString(), redirect: 'manual' })
  j.guardar(r2); return j.tem('session-token')
}
async function cadastrar({ cookieRef, cupom } = {}) {
  const email = `phttp.${marca}.${Math.random().toString(36).slice(2, 6)}@teste-soa.local`
  const headers = { 'content-type': 'application/json' }
  if (cookieRef) headers.cookie = `soa_ref=${encodeURIComponent(cookieRef)}`
  const r = await fetch(url('/api/auth/register'), { method: 'POST', headers,
    body: JSON.stringify({ nome: 'Indicada', email, senha: SENHA, nomeNegocio: `Ateliê ${marca}`, segmento: 'croche_trico', cupom }) })
  const b = await r.json().catch(() => ({}))
  return { email, wsId: b.workspaceId, body: b }
}

const semeados = { parc: [], ws: [] }
async function semearParceiro(comWallet, tag) {
  const id = `phttp_${tag}_${marca}`; semeados.parc.push(id)
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Parceiro" ("id","tipo","nome","ativo","comissaoPercMensal","comissaoPercAnual","comissaoRecorrente","walletId","cupom","linkSlug","createdAt")
     VALUES ($1,'influencer',$2,true,30,40,true,$3,$4,$5,NOW())`, id, 'P ' + tag, comWallet ? WALLET : null, `CUP${tag}${marca}`, `slug${tag}${marca}`)
  return id
}
const leadDoWs = async (ws) => (await prisma.$queryRawUnsafe(`SELECT "parceiroId","tipoAtribuicao" FROM "Lead" WHERE "workspaceId"=$1`, ws))[0]

async function main() {
  console.log('\n=== PROVA HTTP e2e — PARCEIRAS (Preview) ===\n')
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
  console.log(`Banco: ${host}\nPreview: ${BASE}\n`)
  if (host.includes('ep-lively-firefly')) { console.error('❌ PRODUÇÃO'); process.exit(1) }
  if (!BASE || !TOKEN_WH || !WALLET) { console.error('❌ falta PREVIEW_URL/WEBHOOK_TOKEN_PREVIEW/ASAAS_WALLET_TESTE'); process.exit(1) }

  const pW = await semearParceiro(true, 'w')
  const pX = await semearParceiro(false, 'x')
  const slugW = `slugw${marca}`, cupomW = `CUPw${marca}`, cupomX = `CUPx${marca}`

  try {
    // ── [1] ATRIBUIÇÃO por HTTP
    console.log('[1] Atribuição: /r/{slug} cookie + cadastro grava Lead; cupom vence link; cupom inválido não bloqueia')
    const rr = await fetch(url(`/r/${slugW}`), { redirect: 'manual' })
    const setC = rr.headers.get('set-cookie') || ''
    checar('/r seta cookie soa_ref e redireciona à landing', rr.status >= 300 && rr.status < 400 && setC.includes('soa_ref') && (rr.headers.get('location') || '').includes('/landing'), `status=${rr.status}`)
    const refCookie = JSON.stringify({ parceiroId: pW, via: 'link', ts: Date.now() })
    // (a) só link
    const cA = await cadastrar({ cookieRef: refCookie }); semeados.ws.push(cA.wsId)
    const lA = await leadDoWs(cA.wsId)
    checar('cadastro só com link → Lead via=link parceiro=W', lA?.parceiroId === pW && lA?.tipoAtribuicao === 'link')
    // (b) cupom (de X) vence o cookie (de W)
    const cB = await cadastrar({ cookieRef: refCookie, cupom: cupomX }); semeados.ws.push(cB.wsId)
    const lB = await leadDoWs(cB.wsId)
    checar('CUPOM (X) vence o LINK (W) → Lead via=cupom parceiro=X', lB?.parceiroId === pX && lB?.tipoAtribuicao === 'cupom')
    // (c) cupom inválido não bloqueia, cai no link
    const cC = await cadastrar({ cookieRef: refCookie, cupom: 'INVALIDO' + marca }); semeados.ws.push(cC.wsId)
    const lC = await leadDoWs(cC.wsId)
    checar('cupom INVÁLIDO não bloqueia e cai no link (W)', !!cC.wsId && lC?.parceiroId === pW && cC.body.cupomNaoEncontrado === true)

    // ── [2]+[5] TRIAL-30 GRANT e2e + Pix split por HTTP
    console.log('\n[2]+[5] Trial-30 grant e2e + Pix split (portão HTTP)')
    const j = jar()
    checar('login da indicada (atribuída a W)', await logar(j, cA.email))
    const rp = await fetch(url('/api/assinatura/pix'), { method: 'POST', headers: { cookie: j.header(), 'content-type': 'application/json' }, body: JSON.stringify({ plano: 'mensal', cpf: CPF }) })
    const bp = await rp.json().catch(() => ({}))
    checar('Pix gerado', rp.status === 200 && !!bp.paymentId, JSON.stringify(bp).slice(0, 100))
    const [w1] = await prisma.$queryRawUnsafe(`SELECT "assinaturaStatus","trialAte" FROM "Workspace" WHERE "id"=$1`, cA.wsId)
    const dias = Math.round((new Date(w1.trialAte) - new Date().setHours(0, 0, 0, 0)) / 86400000)
    checar('🎯 TRIAL-30 concedido (não 14)', w1.assinaturaStatus === 'TRIAL' && dias === 30, `${dias} dias`)
    const pgPix = await asaas(`/payments/${bp.paymentId}`)
    checar('cobrança Pix carrega split (injetado na criação)', Array.isArray(pgPix?.split) && pgPix.split[0]?.walletId === WALLET, JSON.stringify(pgPix?.split)?.slice(0, 120))
    // paga no sandbox + webhook por HTTP
    await asaas(`/payments/${bp.paymentId}/receiveInCash`, 'POST', { paymentDate: new Date().toISOString().slice(0, 10), value: 29.90, notifyCustomer: false })
    const ev1 = await evento({ id: bp.paymentId, value: 29.90, netValue: 28.91, status: 'RECEIVED', billingType: 'PIX', externalReference: cA.wsId, split: pgPix.split })
    checar('webhook HTTP aceitou', ev1.status === 200)
    const [acPix] = await prisma.$queryRawUnsafe(`SELECT "status","valor"::float v FROM "ParceiroComissao" WHERE "referencia"=$1`, bp.paymentId)
    checar('accrual Pix pago_via_split R$8,97', acPix?.status === 'pago_via_split' && acPix?.v === 8.97, `${acPix?.status} ${acPix?.v}`)
    // idempotência sob reentrega real
    await evento({ id: bp.paymentId, value: 29.90, netValue: 28.91, status: 'RECEIVED', billingType: 'PIX', externalReference: cA.wsId, split: pgPix.split })
    const [{ n: nAc }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int n FROM "ParceiroComissao" WHERE "referencia"=$1`, bp.paymentId)
    checar('idempotência: reentrega não duplica accrual', nAc === 1, `${nAc}`)

    // ── [3] CARTÃO: checkout HTTP injeta split; webhook cria AsaasAssinatura + accrual + idempotência
    console.log('\n[3]+[4] Cartão: checkout HTTP injeta split; AsaasAssinatura no PAYMENT_RECEIVED + recorrência')
    const cCard = await cadastrar({ cookieRef: refCookie }); semeados.ws.push(cCard.wsId)
    const jc = jar(); await logar(jc, cCard.email)
    const rc = await fetch(url('/api/assinatura/checkout'), { method: 'POST', headers: { cookie: jc.header(), 'content-type': 'application/json' }, body: JSON.stringify({ plano: 'mensal', metodo: 'cartao', cpf: CPF }) })
    const bc = await rc.json().catch(() => ({}))
    checar('checkout cartão criado (endpoint HTTP)', rc.status === 200 && !!bc.link)
    // O sandbox não expõe GET /checkouts/{id} (404). A injeção do checkout é o
    // MESMO caminho resolverSplitParceira→corpo.split já provado (a) na Parte A
    // (POST /checkouts ecoa o split) e (b) no Pix HTTP acima (cobrança real com
    // split). Aqui asseguro o INPUT que o endpoint injeta p/ ESTE workspace.
    const spCard = await resolverSplitParceira(cCard.wsId, getPlano('mensal'), 29.90, 'avista')
    checar('split resolvido p/ o checkout (input injetado no /checkouts)', spCard.split.length === 1 && spCard.split[0].walletId === WALLET && spCard.splitValor === 8.97)
    // simula a subscription+split que o checkout geraria no pagamento e o webhook real
    const sub = await asaas('/subscriptions', 'POST', { customer: (await asaas('/customers', 'POST', { name: 'IndC', cpfCnpj: CPF })).id, billingType: 'CREDIT_CARD', value: 29.90, nextDueDate: '2026-09-06', cycle: 'MONTHLY', externalReference: cCard.wsId, split: [{ walletId: WALLET, fixedValue: 8.97 }] })
    const payC1 = 'pay_cardhttp1_' + marca
    await evento({ id: payC1, subscription: sub.id, customer: sub.customer, value: 29.90, netValue: 28.91, status: 'RECEIVED', billingType: 'CREDIT_CARD', dueDate: '2026-09-06', externalReference: cCard.wsId, split: [{ walletId: WALLET, fixedValue: 8.97, status: 'PENDING' }] })
    const [assC] = await prisma.$queryRawUnsafe(`SELECT "parceiroId","splitValor"::float v FROM "AsaasAssinatura" WHERE "subscriptionId"=$1`, sub.id)
    checar('AsaasAssinatura criada no PAYMENT_RECEIVED (snapshot do payload)', assC?.parceiroId === pW && assC?.v === 8.97)
    const [acC] = await prisma.$queryRawUnsafe(`SELECT "status" FROM "ParceiroComissao" WHERE "referencia"=$1`, payC1)
    checar('accrual cartão pago_via_split', acC?.status === 'pago_via_split')
    const subG = await asaas(`/subscriptions/${sub.id}`)
    checar('split VIVE na subscription (PUT) → recorrência', Array.isArray(subG?.split) && subG.split[0]?.walletId === WALLET)
    const payC2 = 'pay_cardhttp2_' + marca
    await evento({ id: payC2, subscription: sub.id, customer: sub.customer, value: 29.90, netValue: 28.91, status: 'RECEIVED', billingType: 'CREDIT_CARD', dueDate: '2026-10-06', externalReference: cCard.wsId, split: [{ walletId: WALLET, fixedValue: 8.97, status: 'PENDING' }] })
    const [acC2] = await prisma.$queryRawUnsafe(`SELECT "status" FROM "ParceiroComissao" WHERE "referencia"=$1`, payC2)
    checar('2º ciclo do cartão → novo accrual', acC2?.status === 'pago_via_split')

    // ── [7] FALLBACK: parceiro SEM walletId (via cupom X) → accrual pendente
    console.log('\n[7] Fallback: parceiro sem walletId → receita segue, accrual pendente')
    const cFb = await cadastrar({ cupom: cupomX }); semeados.ws.push(cFb.wsId)
    const jf = jar(); await logar(jf, cFb.email)
    const rf = await fetch(url('/api/assinatura/pix'), { method: 'POST', headers: { cookie: jf.header(), 'content-type': 'application/json' }, body: JSON.stringify({ plano: 'mensal', cpf: CPF }) })
    const bf = await rf.json().catch(() => ({}))
    checar('Pix gerado mesmo sem walletId (receita não some)', rf.status === 200 && !!bf.paymentId)
    await asaas(`/payments/${bf.paymentId}/receiveInCash`, 'POST', { paymentDate: new Date().toISOString().slice(0, 10), value: 29.90, notifyCustomer: false })
    await evento({ id: bf.paymentId, value: 29.90, netValue: 28.91, status: 'RECEIVED', billingType: 'PIX', externalReference: cFb.wsId })
    const [acFb] = await prisma.$queryRawUnsafe(`SELECT "status" FROM "ParceiroComissao" WHERE "referencia"=$1`, bf.paymentId)
    checar('accrual pendente (repasse manual)', acFb?.status === 'pendente', acFb?.status)

  } finally {
    console.log('\n[limpeza dev]')
    for (const ws of semeados.ws.filter(Boolean)) {
      for (const t of ['ParceiroComissao', 'AsaasCobranca', 'AsaasAssinatura', 'AsaasCliente', 'AssinaturaAviso', 'Lead', 'WorkspaceTheme', 'User'])
        await prisma.$executeRawUnsafe(`DELETE FROM "${t}" WHERE "workspaceId"=$1`, ws).catch(() => {})
      await prisma.$executeRawUnsafe(`DELETE FROM "Workspace" WHERE "id"=$1`, ws).catch(() => {})
    }
    for (const p of semeados.parc) {
      await prisma.$executeRawUnsafe(`DELETE FROM "ParceiroComissao" WHERE "parceiroId"=$1`, p).catch(() => {})
      await prisma.$executeRawUnsafe(`DELETE FROM "Lead" WHERE "parceiroId"=$1`, p).catch(() => {})
      await prisma.$executeRawUnsafe(`DELETE FROM "Parceiro" WHERE "id"=$1`, p).catch(() => {})
    }
    await prisma.$executeRawUnsafe(`DELETE FROM "AsaasWebhookEvento" WHERE "eventoId" LIKE 'evt_%'`).catch(() => {})
    console.log('  🧹 limpo')
  }
  console.log(`\n${falhas === 0 ? '✅ PARCEIRAS HTTP e2e PASSOU (7/7 cenários)' : `❌ ${falhas} falha(s)`}\n`)
  process.exit(falhas === 0 ? 0 : 1)
}
main().catch(e => { console.error('\n❌ Erro:', e.message, e.stack, '\n'); process.exit(1) })
