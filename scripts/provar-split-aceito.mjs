// ─────────────────────────────────────────────────────────────────────────────
// PROVA do SPLIT ACEITO — a que faltou na Etapa 3.
//
// Usa a carteira de uma SEGUNDA conta sandbox (influenciadora de teste), porque o
// Asaas recusa split para a carteira do próprio dono. Com wallet de terceiro, o
// caminho feliz finalmente pode ser exercitado.
//
// USO:
//   PREVIEW_URL=https://<preview>.vercel.app \
//   ASAAS_WALLET_TESTE=<walletId da 2ª conta> \
//   node --env-file=.env --env-file=.env.local scripts/provar-split-aceito.mjs
//
// ⚠️ Cria assinatura ANUAL de verdade no sandbox. Limpa o banco dev; o que fica no
//    Asaas é reportado para o Júnior confirmar o pagamento.
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const BASE = (process.env.PREVIEW_URL || '').replace(/\/+$/, '')
const BYPASS = (process.env.VERCEL_BYPASS_SECRET || '').trim()
const WALLET = (process.env.ASAAS_WALLET_TESTE || '').trim()
const API_KEY = (process.env.ASAAS_API_KEY || '').trim()
const SENHA = 'Teste@' + Math.random().toString(36).slice(2, 10)
const CPF_OK = '24971563792'

let falhas = 0
const checar = (n, ok, d = '') => { if (!ok) falhas++; console.log(`  ${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`) }
const url = (p) => `${BASE}${p}${BYPASS ? (p.includes('?') ? '&' : '?') + 'x-vercel-protection-bypass=' + BYPASS : ''}`
const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const marca = Date.now().toString(36)

function jar() {
  const c = new Map()
  return {
    guardar(r) { for (const [k, v] of r.headers) { if (k.toLowerCase() !== 'set-cookie') continue
      for (const p of v.split(/,(?=[^;]+=)/)) { const [n, val] = p.split(';')[0].split('='); if (n && val !== undefined) c.set(n.trim(), val.trim()) } } },
    header() { return [...c].map(([k, v]) => `${k}=${v}`).join('; ') },
    tem(s) { return [...c.keys()].some(k => k.includes(s)) },
  }
}
async function logar(email) {
  const j = jar()
  const r1 = await fetch(url('/api/auth/csrf'), { headers: { cookie: j.header() } }); j.guardar(r1)
  const { csrfToken } = await r1.json()
  const r2 = await fetch(url('/api/auth/callback/credentials'), {
    method: 'POST', headers: { cookie: j.header(), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, senha: SENHA, csrfToken, callbackUrl: `${BASE}/dashboard`, json: 'true' }).toString(),
    redirect: 'manual' })
  j.guardar(r2)
  return j.tem('session-token') ? j : null
}
const asaas = async (p) => (await fetch(`https://api-sandbox.asaas.com/v3${p}`, {
  headers: { access_token: API_KEY } })).json()

async function main() {
  console.log('\n=== PROVA — SPLIT ACEITO (carteira de terceiro) ===\n')
  if (!BASE || !WALLET) { console.error('❌ Falta PREVIEW_URL ou ASAAS_WALLET_TESTE\n'); process.exitCode = 1; return }
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
  console.log(`Banco:   ${host}`)
  console.log(`Wallet:  ${WALLET}\n`)
  if (host.includes('ep-lively-firefly')) { console.error('❌ PRODUÇÃO\n'); process.exitCode = 1; return }

  const ws = `wsteste_split_${marca}`
  const email = `split.${marca}@teste-soa.local`
  const parceiroId = `ptest_split_${marca}`

  try {
    const hash = await bcrypt.hash(SENHA, 10)
    const trial = new Date(); trial.setDate(trial.getDate() + 5)
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Workspace" ("id","nome","slug","plano","ativo","assinaturaStatus","trialAte")
       VALUES ($1,$2,$3,'TRIAL',true,'TRIAL',$4)`, ws, 'Ateliê Split', ws, trial)
    await prisma.$executeRawUnsafe(
      `INSERT INTO "User" ("id","workspaceId","nome","email","senha","role","ativo")
       VALUES ($1,$2,'Teste',$3,$4,'ADMIN',true)`, gerarId(), ws, email, hash)
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Parceiro" ("id","tipo","nome","ativo","comissaoPercMensal","comissaoPercAnual","comissaoRecorrente","walletId","createdAt")
       VALUES ($1,'influencer','artesetal01 (teste)',true,30,40,true,$2,NOW())`, parceiroId, WALLET)
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Lead" ("id","nome","telefone","email","origem","consentimento","parceiroId","status","workspaceId","createdAt")
       VALUES ($1,'Lead','','x@y.z','parceiro',true,$2,'trial',$3,NOW())`, gerarId(), parceiroId, ws)

    console.log('[1] Assinando plano ANUAL com split de 40%')
    const j = await logar(email)
    checar('login', !!j)
    const r = await fetch(url('/api/assinatura/assinar'), {
      method: 'POST', headers: { cookie: j.header(), 'content-type': 'application/json' },
      body: JSON.stringify({ cpf: CPF_OK, plano: 'anual' }) })
    const body = await r.json().catch(() => ({}))
    checar('assinatura criada', r.status === 200 && !!body.subscriptionId, body.subscriptionId || JSON.stringify(body))
    if (!body.subscriptionId) throw new Error('sem assinatura')

    console.log('\n[2] Snapshot do split no nosso banco')
    const [snap] = await prisma.$queryRawUnsafe(
      `SELECT "splitWalletId","splitValor"::float AS v,"splitPercentual"::float AS p,"splitErro","valor"::float AS valor,"ciclo"
       FROM "AsaasAssinatura" WHERE "subscriptionId" = $1`, body.subscriptionId)
    checar('walletId gravado', snap?.splitWalletId === WALLET, snap?.splitWalletId)
    checar('splitValor = 96.16 (40% de 240,40)', snap?.v === 96.16, String(snap?.v))
    checar('splitPercentual = 40', snap?.p === 40, String(snap?.p))
    checar('SEM erro de split (foi aceito)', snap?.splitErro === null, snap?.splitErro ?? '(nenhum)')
    checar('ciclo YEARLY, valor 240.40', snap?.ciclo === 'YEARLY' && snap?.valor === 240.4)

    console.log('\n[3] O que o ASAAS diz sobre a assinatura')
    const sub = await asaas(`/subscriptions/${body.subscriptionId}`)
    console.log(`  status=${sub?.status} cycle=${sub?.cycle} value=${sub?.value} nextDueDate=${sub?.nextDueDate}`)
    const splits = await asaas(`/subscriptions/${body.subscriptionId}/splits`)
    const lista = splits?.data ?? (Array.isArray(splits) ? splits : [])
    checar('Asaas confirma o split na assinatura', lista.length > 0, JSON.stringify(lista).slice(0, 300))
    for (const s of lista) console.log(`     wallet=${s.walletId} fixedValue=${s.fixedValue} status=${s.status ?? '—'}`)

    console.log('\n[4] Cobrança gerada')
    const pays = await asaas(`/subscriptions/${body.subscriptionId}/payments`)
    const cob = pays?.data?.[0]
    checar('cobrança existe', !!cob?.id, `${cob?.id} R$${cob?.value} venc=${cob?.dueDate} ${cob?.status}`)
    checar('invoiceUrl devolvida pela nossa API', !!body.invoiceUrl)
    console.log(`\n     🔗 PARA O JÚNIOR PAGAR: ${body.invoiceUrl || cob?.invoiceUrl}`)
    console.log(`     assinatura: ${body.subscriptionId}`)
    console.log(`     cobrança:   ${cob?.id}`)
    console.log(`     comissão esperada na artesetal01: R$ 96,16`)

  } finally {
    console.log('\n[limpeza do banco DEV — o Asaas mantém a assinatura para o teste de pagamento]')
    await prisma.$executeRawUnsafe(`DELETE FROM "Lead" WHERE "workspaceId" LIKE 'wsteste_split_%'`)
    await prisma.$executeRawUnsafe(`DELETE FROM "Parceiro" WHERE "id" LIKE 'ptest_split_%'`)
    await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE "workspaceId" LIKE 'wsteste_split_%'`)
    console.log('  🧹 parceiro/lead/usuária removidos (assinatura e workspace mantidos p/ o pagamento)')
  }

  console.log(`\n${falhas === 0 ? '✅ TODAS as provas passaram' : `❌ ${falhas} falha(s)`}\n`)
  process.exitCode = falhas === 0 ? 0 : 1
}

main().catch(e => { console.error('\n❌ Erro:', e.message, '\n'); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
