// ─────────────────────────────────────────────────────────────────────────────
// Dispara um PAYMENT_RECEIVED SIMULADO contra o webhook no PREVIEW da Vercel.
//
// Valida, em segundos e sem depender de ninguém: a rota responde, o bypass da
// Deployment Protection funciona, o token é aceito, e a escrita cai no banco DEV.
// Só depois disto vale a pena pedir o pagamento real no painel do Asaas.
//
// USO:
//   PREVIEW_URL=https://<preview>.vercel.app \
//   WEBHOOK_TOKEN=<token gerado em /master/asaas> \
//   [BYPASS_SECRET=<protection bypass>] \
//   node --env-file=.env --env-file=.env.local scripts/disparar-webhook-simulado.mjs
//
// ⚠️ O eventoId leva prefixo "evt_teste_" DE PROPÓSITO: jamais colide com id real
//    do Asaas, e permite limpar depois sem tocar em evento verdadeiro.
// ⚠️ Nenhum segredo é impresso. NÃO chama a API do Asaas — o payload é sintético.
// ─────────────────────────────────────────────────────────────────────────────
import crypto from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const PREVIEW_URL = (process.env.PREVIEW_URL || '').replace(/\/+$/, '')
const TOKEN = process.env.WEBHOOK_TOKEN || ''
const BYPASS = process.env.BYPASS_SECRET || ''
const LIMPAR = process.argv.includes('--limpar')

const prisma = new PrismaClient()
let falhas = 0
const checar = (nome, ok, det = '') => {
  if (!ok) falhas++
  console.log(`  ${ok ? '✅' : '❌'} ${nome}${det ? ` — ${det}` : ''}`)
}

const EVENTO_ID = 'evt_teste_' + crypto.randomBytes(8).toString('hex')
const PAYMENT_ID = 'pay_teste_' + crypto.randomBytes(8).toString('hex')

// Formato documentado do PAYMENT_RECEIVED do Asaas.
const payload = {
  id: EVENTO_ID,
  event: 'PAYMENT_RECEIVED',
  dateCreated: '2026-07-22 12:00:00',
  account: { id: 'acc_teste', ownerId: 'own_teste' },
  payment: {
    object: 'payment',
    id: PAYMENT_ID,
    customer: 'cus_teste_simulado',
    value: 5.0,
    netValue: 3.01,
    status: 'RECEIVED',
    billingType: 'PIX',
    dueDate: '2026-07-23',
    externalReference: 'teste-simulado',
    creditCard: { creditCardNumber: '4444', creditCardBrand: 'VISA', creditCardToken: 'tok-teste' },
  },
}

async function main() {
  console.log('\n=== DISPARO SIMULADO — webhook no preview ===\n')

  if (!PREVIEW_URL || !TOKEN) {
    console.error('❌ Faltam PREVIEW_URL e/ou WEBHOOK_TOKEN no ambiente.\n')
    process.exitCode = 1
    return
  }

  // Guarda dura: se o banco apontado não for o de dev, aborta antes de escrever.
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
  console.log(`Banco alvo: ${host || '(desconhecido)'}`)
  if (host.includes('ep-lively-firefly')) {
    console.error('\n❌ DATABASE_URL aponta para PRODUÇÃO. Abortando.\n')
    process.exitCode = 1
    return
  }

  const url = `${PREVIEW_URL}/api/webhooks/asaas${BYPASS ? `?x-vercel-protection-bypass=${BYPASS}` : ''}`
  console.log(`Alvo: ${PREVIEW_URL}/api/webhooks/asaas${BYPASS ? ' (+bypass)' : ''}\n`)

  const postar = (token) => fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'asaas-access-token': token } : {}),
      ...(BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {}),
    },
    body: JSON.stringify(payload),
  })

  if (LIMPAR) {
    const n = await prisma.$executeRaw`
      DELETE FROM "AsaasWebhookEvento" WHERE "eventoId" LIKE 'evt_teste_%'`
    const m = await prisma.$executeRaw`
      DELETE FROM "AsaasCobranca" WHERE "paymentId" LIKE 'pay_teste_%'`
    console.log(`  🧹 removidos: ${n} evento(s), ${m} cobrança(s) de teste\n`)
    return
  }

  // [1] a rota está acessível? (pega Deployment Protection antes de tudo)
  console.log('[1] Rota acessível (proteção da Vercel não barrou)')
  const semToken = await postar(null)
  const corpoBruto = await semToken.text()
  // A proteção da Vercel responde 401 em DUAS formas: HTML (SSO) ou JSON com
  // {"error":{"message":"Protected deployment"},"protection":{...}}. Ambas parecem
  // com o nosso 401 de fail-closed no status — só o CORPO distingue.
  const barradoPelaVercel = semToken.status === 401 && (
    /<!DOCTYPE html|Authentication Required|_vercel\/sso/i.test(corpoBruto)
    || /"Protected deployment"|vercel_auth_enabled|vercel\.com\/sso-api/i.test(corpoBruto)
  )
  if (barradoPelaVercel) {
    checar('passou pela Deployment Protection', false, 'a Vercel respondeu 401 antes da nossa rota — gere o Protection Bypass')
    console.log(`\n❌ Bloqueado pela proteção da Vercel. Rode de novo com BYPASS_SECRET.\n`)
    process.exitCode = 1
    return
  }
  checar('chegou na nossa rota (não é 401 da Vercel)', true)

  // [2] fail closed: sem token → 401 nosso
  checar('sem token → 401 (fail closed)', semToken.status === 401, `status ${semToken.status}`)

  // [3] token errado → 401
  const errado = await postar('token-errado-de-mesmo-tamanho-aproximado')
  checar('token errado → 401', errado.status === 401, `status ${errado.status}`)

  // [4] token correto → processa
  console.log('\n[2] Evento válido é aceito e processado')
  const ok = await postar(TOKEN)
  const corpo = await ok.json().catch(() => ({}))
  checar('responde 200', ok.status === 200, `status ${ok.status}`)
  checar('processado=true', corpo.processado === true, JSON.stringify(corpo))
  if (corpo.processado !== true && corpo.guardado) {
    console.log('     ↳ módulo está DESLIGADO no preview — ligue a flag em /master/asaas')
  }

  // [5] evidência no banco DEV
  console.log('\n[3] Evidência no banco de DEV')
  const [ev] = await prisma.$queryRaw`
    SELECT "eventoId","evento","processadoEm","erro","payload"
    FROM "AsaasWebhookEvento" WHERE "eventoId" = ${EVENTO_ID} LIMIT 1`
  checar('evento gravado', !!ev, ev?.eventoId ?? '')
  checar('processadoEm preenchido', !!ev?.processadoEm)
  checar('cartão mascarado no JSONB',
    ev?.payload?.payment?.creditCard?.creditCardNumber === '[REMOVIDO]',
    JSON.stringify(ev?.payload?.payment?.creditCard?.creditCardNumber))

  const [cob] = await prisma.$queryRaw`
    SELECT "paymentId","status","valor"::float AS "valor","pagoEm"
    FROM "AsaasCobranca" WHERE "paymentId" = ${PAYMENT_ID} LIMIT 1`
  checar('cobrança criada', !!cob)
  checar('status RECEIVED', cob?.status === 'RECEIVED', cob?.status ?? '')
  checar('pagoEm preenchido', !!cob?.pagoEm)

  // [6] idempotência ponta a ponta
  console.log('\n[4] Reenvio do mesmo eventoId (idempotência)')
  const dup = await postar(TOKEN)
  const corpoDup = await dup.json().catch(() => ({}))
  checar('jaProcessado=true', corpoDup.jaProcessado === true, JSON.stringify(corpoDup))
  const [{ n }] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS n FROM "AsaasWebhookEvento" WHERE "eventoId" = ${EVENTO_ID}`
  checar('continua 1 linha só', n === 1, `linhas: ${n}`)

  console.log(`\n${falhas === 0 ? '✅ SIMULADO PASSOU — pode pedir o pagamento real' : `❌ ${falhas} falha(s)`}`)
  console.log(`\n   Para limpar depois: node … scripts/disparar-webhook-simulado.mjs --limpar\n`)
  process.exitCode = falhas === 0 ? 0 : 1
}

main()
  .catch(e => { console.error('\n❌ Erro:', String(e.message).replace(/\$aact_[\w+/=-]+/g, '[REDACTED]'), '\n'); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
