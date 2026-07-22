// ─────────────────────────────────────────────────────────────────────────────
// PROVA do webhook do Asaas — 4 cenários, com evidência lida do BANCO.
//
// PRÉ-REQUISITOS (nesta ordem; a ORDEM dos --env-file importa — o último vence):
//   1. node --env-file=.env --env-file=.env.local scripts/migrar-asaas-fundacao.mjs --apply
//   2. npm run dev                     (deixar rodando noutro terminal)
//   3. node --env-file=.env --env-file=.env.local scripts/provar-webhook-asaas.mjs
//
// .env       → segredos gerais (não duplicar no .env.local)
// .env.local → DATABASE_URL/DIRECT_URL do branch Neon de DEV, ASAAS_API_KEY sandbox
//              e ASAAS_TOKEN_KEY (cripto das credenciais do Asaas; cai em
//              LOGISTICA_TOKEN_KEY se não existir)
//
// O script cuida sozinho de: gravar um token de webhook de teste, desligar/ligar a
// flag no momento certo e limpar os eventos de teste no fim.
// NÃO chama a API do Asaas — os payloads são simulados no formato documentado.
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'
import crypto from 'node:crypto'

const prisma = new PrismaClient()
const URL_BASE = process.env.URL_BASE || 'http://localhost:3000'
const ROTA = `${URL_BASE}/api/webhooks/asaas`

const TOKEN = 'token-de-teste-' + crypto.randomBytes(8).toString('hex')
const EVENTO_ID = 'evt_teste_' + crypto.randomBytes(8).toString('hex')
const PAYMENT_ID = 'pay_teste_' + crypto.randomBytes(8).toString('hex')

let falhas = 0
function checar(nome, ok, detalhe = '') {
  if (!ok) falhas++
  console.log(`  ${ok ? '✅' : '❌'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
}

// Mesma criptografia de lib/pagamento/asaas/cripto.ts (AES-256-GCM, "v1:iv:tag:dados"),
// inclusive a ordem de fallback das chaves — senão o token gravado aqui não abriria lá.
function encryptToken(plain) {
  const raw = process.env.ASAAS_TOKEN_KEY
    || process.env.LOGISTICA_TOKEN_KEY
    || process.env.CPF_ENCRYPTION_KEY
  if (!raw) throw new Error('ASAAS_TOKEN_KEY (ou LOGISTICA_TOKEN_KEY) ausente no env — não dá para gravar o token.')
  const key = crypto.createHash('sha256').update(raw).digest()
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return `v1:${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${enc.toString('base64')}`
}

// Payload PAYMENT_RECEIVED no formato documentado pelo Asaas.
const payload = {
  id: EVENTO_ID,
  event: 'PAYMENT_RECEIVED',
  dateCreated: '2026-07-22 10:15:00',
  account: { id: 'acc_teste', ownerId: 'own_teste' },
  payment: {
    object: 'payment',
    id: PAYMENT_ID,
    customer: 'cus_teste_000005219613',
    value: 89.9,
    netValue: 87.42,
    status: 'RECEIVED',
    billingType: 'CREDIT_CARD',
    dueDate: '2026-07-25',
    externalReference: 'ws_teste',
    creditCard: { creditCardNumber: '4444', creditCardBrand: 'MASTERCARD', creditCardToken: 'tok-abc-123' },
  },
}

const postar = (token) => fetch(ROTA, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { 'asaas-access-token': token } : {}) },
  body: JSON.stringify(payload),
})

async function configurar({ ativo }) {
  await prisma.$executeRaw`
    INSERT INTO "AsaasConfig" ("id","escopo","conectado","sandbox","ativo","updatedAt")
    SELECT ${'cfg' + Date.now().toString(36)}, 'plataforma', true, true, ${ativo}, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM "AsaasConfig" WHERE "escopo" = 'plataforma')
  `
  // conectado=true e apiKey presente são exigidos por asaasOperacional().
  await prisma.$executeRaw`
    UPDATE "AsaasConfig" SET
      "webhookTokenCripto" = ${encryptToken(TOKEN)},
      "apiKeyCripto" = COALESCE("apiKeyCripto", ${encryptToken('chave-falsa-so-para-teste-local')}),
      "conectado" = true, "ativo" = ${ativo}, "updatedAt" = NOW()
    WHERE "escopo" = 'plataforma'
  `
}

const lerEvento = async () => (await prisma.$queryRaw`
  SELECT "id","eventoId","evento","pagamentoRef","processadoEm","erro","payload"
  FROM "AsaasWebhookEvento" WHERE "eventoId" = ${EVENTO_ID} LIMIT 1
`)[0]

const lerCobranca = async () => (await prisma.$queryRaw`
  SELECT "paymentId","status","valor"::float AS "valor","pagoEm"
  FROM "AsaasCobranca" WHERE "paymentId" = ${PAYMENT_ID} LIMIT 1
`)[0]

const contarEventos = async () => (await prisma.$queryRaw`
  SELECT COUNT(*)::int AS "n" FROM "AsaasWebhookEvento" WHERE "eventoId" = ${EVENTO_ID}
`)[0].n

async function main() {
  console.log(`\n=== PROVA DO WEBHOOK ASAAS — ${ROTA} ===\n`)

  // ── (a) token inválido → 401
  console.log('[a] Token inválido/ausente deve ser rejeitado')
  await configurar({ ativo: false })
  checar('sem header → 401', (await postar(null)).status === 401)
  const rErrado = await postar('token-errado-mas-do-mesmo-tamanho')
  checar('token errado → 401', rErrado.status === 401, `status ${rErrado.status}`)
  checar('nada foi gravado', (await contarEventos()) === 0)

  // ── (d) flag OFF → guarda sem alterar cobrança  (antes de (b): flag já está OFF)
  console.log('\n[d] Módulo DESLIGADO: guarda o evento, não altera cobrança')
  const rOff = await postar(TOKEN)
  const bOff = await rOff.json()
  checar('responde 200', rOff.status === 200, `status ${rOff.status}`)
  checar('processado=false', bOff.processado === false)
  const evOff = await lerEvento()
  checar('evento gravado', !!evOff)
  checar('marcado como pendente', evOff && evOff.processadoEm === null)
  checar('cobrança NÃO criada', !(await lerCobranca()))
  checar('cartão mascarado no JSONB',
    evOff?.payload?.payment?.creditCard?.creditCardNumber === '[REMOVIDO]',
    `valor gravado: ${JSON.stringify(evOff?.payload?.payment?.creditCard?.creditCardNumber)}`)

  // ── (c) reenvio do MESMO evento → idempotência
  console.log('\n[c] Reenvio do MESMO eventoId não duplica nem reprocessa')
  const rDup = await postar(TOKEN)
  const bDup = await rDup.json()
  checar('responde 200', rDup.status === 200)
  checar('jaProcessado=true', bDup.jaProcessado === true)
  checar('continua 1 linha só', (await contarEventos()) === 1, `linhas: ${await contarEventos()}`)

  // ── (b) evento novo com módulo LIGADO → processa
  console.log('\n[b] Módulo LIGADO: evento novo é processado e vira cobrança')
  await configurar({ ativo: true })
  const EV2 = 'evt_teste_' + crypto.randomBytes(8).toString('hex')
  const PAY2 = 'pay_teste_' + crypto.randomBytes(8).toString('hex')
  const r2 = await fetch(ROTA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'asaas-access-token': TOKEN },
    body: JSON.stringify({ ...payload, id: EV2, payment: { ...payload.payment, id: PAY2 } }),
  })
  const b2 = await r2.json()
  checar('responde 200', r2.status === 200)
  checar('processado=true', b2.processado === true, JSON.stringify(b2))

  const [ev2] = await prisma.$queryRaw`
    SELECT "processadoEm" FROM "AsaasWebhookEvento" WHERE "eventoId" = ${EV2} LIMIT 1`
  checar('evento marcado como processado', !!ev2?.processadoEm)

  const [cob2] = await prisma.$queryRaw`
    SELECT "status","valor"::float AS "valor","pagoEm" FROM "AsaasCobranca" WHERE "paymentId" = ${PAY2} LIMIT 1`
  checar('cobrança criada (upsert)', !!cob2)
  checar('status = RECEIVED', cob2?.status === 'RECEIVED', cob2?.status)
  checar('valor 89.9', cob2?.valor === 89.9, String(cob2?.valor))
  checar('pagoEm preenchido', !!cob2?.pagoEm)

  // ── reprocessamento do que ficou pendente com a flag OFF
  console.log('\n[e] Reprocessar pendentes (evento guardado com a flag OFF)')
  const rRep = await fetch(`${URL_BASE}/api/config/asaas/eventos`, { method: 'POST' })
  checar('exige master_token (401 sem cookie)', rRep.status === 401, `status ${rRep.status}`)
  console.log('     ↳ reprocessamento em si: validar pela tela /master/asaas (botão "Reprocessar pendentes")')

  // ── limpeza
  console.log('\n[limpeza] removendo dados de teste')
  await prisma.$executeRaw`DELETE FROM "AsaasWebhookEvento" WHERE "eventoId" IN (${EVENTO_ID}, ${EV2})`
  await prisma.$executeRaw`DELETE FROM "AsaasCobranca" WHERE "paymentId" IN (${PAYMENT_ID}, ${PAY2})`
  await prisma.$executeRaw`
    UPDATE "AsaasConfig" SET "webhookTokenCripto" = NULL, "ativo" = false, "conectado" = false
    WHERE "escopo" = 'plataforma'`
  console.log('  ✅ limpo (token de teste e flag revertidos)')

  console.log(`\n${falhas === 0 ? '✅ TODAS as provas passaram' : `❌ ${falhas} prova(s) falharam`}\n`)
  process.exitCode = falhas === 0 ? 0 : 1
}

main()
  .catch(e => { console.error('\n❌ Erro:', e.message, '\n'); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
