// ─────────────────────────────────────────────────────────────────────────────
// PROVA DO FUNIL COMPLETO — cadastro → trial → tela → assinar → webhook → ATIVA.
//
// É a prova que fecha a Etapa 6: cada etapa foi provada isolada, esta liga tudo
// com sessão real, banco dev e sandbox do Asaas.
//
// USO:
//   PREVIEW_URL=https://<preview>.vercel.app \
//   node --env-file=.env --env-file=.env.local scripts/provar-funil-completo.mjs
//
// Requer no Preview: ASSINATURA_NOVO_CADASTRO=on, ASSINATURA_REVALIDACAO=on.
// ⚠️ Cria dados "wsteste_"/e-mail @teste-soa.local. Aborta se o banco for produção.
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'
import crypto from 'node:crypto'

const prisma = new PrismaClient()
const BASE = (process.env.PREVIEW_URL || '').replace(/\/+$/, '')
const BYPASS = (process.env.VERCEL_BYPASS_SECRET || '').trim()
const TOKEN_WH = (process.env.WEBHOOK_TOKEN_PREVIEW || '').trim()
const SENHA = 'Teste@' + Math.random().toString(36).slice(2, 10)
const CPF_OK = '24971563792'
const marca = Date.now().toString(36)

let falhas = 0
const checar = (n, ok, d = '') => { if (!ok) falhas++; console.log(`  ${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`) }
const url = (p) => `${BASE}${p}${BYPASS ? (p.includes('?') ? '&' : '?') + 'x-vercel-protection-bypass=' + BYPASS : ''}`

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

async function main() {
  console.log('\n=== PROVA DO FUNIL COMPLETO ===\n')
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
  console.log(`Banco:   ${host}\nPreview: ${BASE}\n`)
  if (!BASE || !TOKEN_WH) { console.error('❌ Falta PREVIEW_URL/WEBHOOK_TOKEN_PREVIEW\n'); process.exitCode = 1; return }
  if (host.includes('ep-lively-firefly')) { console.error('❌ PRODUÇÃO\n'); process.exitCode = 1; return }

  const email = `funil.${marca}@teste-soa.local`
  let wsId = null

  try {
    // ── 1. CADASTRO
    console.log('[1] Cadastro cria trial de 14 dias com origem asaas')
    const r1 = await fetch(url('/api/auth/register'), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nome: 'Maria Teste', email, senha: SENHA, nomeNegocio: `Ateliê Funil ${marca}` }) })
    const b1 = await r1.json().catch(() => ({}))
    checar('conta criada', r1.status === 200 && !!b1.workspaceId, JSON.stringify(b1).slice(0, 120))
    wsId = b1.workspaceId
    checar('resposta informa o trial', b1.trialDias === 14, String(b1.trialDias))

    const [w1] = await prisma.$queryRawUnsafe(
      `SELECT "assinaturaOrigem","assinaturaStatus","trialAte","ativo" FROM "Workspace" WHERE "id" = $1`, wsId)
    checar('origem asaas', w1?.assinaturaOrigem === 'asaas', w1?.assinaturaOrigem)
    checar('status TRIAL', w1?.assinaturaStatus === 'TRIAL')
    checar('ativo=true (acesso imediato)', w1?.ativo === true)
    const dias = Math.round((new Date(w1.trialAte) - new Date().setHours(0, 0, 0, 0)) / 86400000)
    checar('trial de 14 dias', dias === 14, `${dias} dias`)

    // ── 2. ACESSO DURANTE O TRIAL
    console.log('\n[2] Durante o trial ela acessa normalmente')
    const j = await logar(email)
    checar('login', !!j)
    const nav = await fetch(url('/dashboard'), { headers: { cookie: j.header() }, redirect: 'manual' })
    checar('dashboard abre (não é redirecionada)', nav.status === 200, `status=${nav.status} ${nav.headers.get('location') ?? ''}`)

    // ── 3. TELA DE ASSINATURA
    console.log('\n[3] Tela de assinatura mostra o estado do trial')
    const api = await fetch(url('/api/assinatura'), { headers: { cookie: j.header() } })
    const d3 = await api.json().catch(() => ({}))
    checar('API responde', api.status === 200)
    checar('status TRIAL com acesso', d3?.estado?.status === 'TRIAL' && d3?.estado?.temAcesso === true)
    checar('dias restantes coerentes', d3?.estado?.diasRestantes === dias + 7, String(d3?.estado?.diasRestantes))
    checar('oferece os 2 planos', d3?.planos?.length === 2, (d3?.planos ?? []).map(p => `${p.id}=${p.valor}`).join(' '))

    // ── 4. ASSINAR
    console.log('\n[4] Assinar plano mensal')
    const r4 = await fetch(url('/api/assinatura/assinar'), {
      method: 'POST', headers: { cookie: j.header(), 'content-type': 'application/json' },
      body: JSON.stringify({ cpf: CPF_OK, plano: 'mensal' }) })
    const b4 = await r4.json().catch(() => ({}))
    checar('assinatura criada', r4.status === 200 && !!b4.subscriptionId, b4.subscriptionId || JSON.stringify(b4))
    checar('invoiceUrl para pagar', !!b4.invoiceUrl)
    if (b4.invoiceUrl) console.log(`     🔗 ${b4.invoiceUrl}`)

    const [cob] = await prisma.$queryRawUnsafe(
      `SELECT "paymentId","valor"::float AS valor,"status" FROM "AsaasCobranca" WHERE "workspaceId" = $1
       ORDER BY "createdAt" DESC LIMIT 1`, wsId)
    checar('cobrança de R$ 29,90 registrada', cob?.valor === 29.9, `${cob?.paymentId} ${cob?.status}`)

    // ── 5. PAGAMENTO → WEBHOOK
    console.log('\n[5] Pagamento confirmado pelo webhook do Asaas')
    const ev = await fetch(url('/api/webhooks/asaas'), {
      method: 'POST', headers: { 'content-type': 'application/json', 'asaas-access-token': TOKEN_WH },
      body: JSON.stringify({
        id: 'evt_teste_' + crypto.randomBytes(8).toString('hex'),
        event: 'PAYMENT_RECEIVED',
        payment: { id: cob.paymentId, subscription: b4.subscriptionId, customer: 'cus_x',
          value: 29.9, netValue: 28.91, status: 'RECEIVED', billingType: 'CREDIT_CARD',
          dueDate: new Date().toISOString().slice(0, 10) } }) })
    const bev = await ev.json().catch(() => ({}))
    checar('webhook processou', ev.status === 200 && bev.processado === true, JSON.stringify(bev))

    const [w5] = await prisma.$queryRawUnsafe(
      `SELECT "assinaturaStatus","ativo","assinaturaExpira" FROM "Workspace" WHERE "id" = $1`, wsId)
    checar('workspace virou ATIVA', w5?.assinaturaStatus === 'ATIVA', w5?.assinaturaStatus)
    checar('ativo=true', w5?.ativo === true)

    // ── 6. ESTADO FINAL NA TELA
    console.log('\n[6] A tela reflete a assinatura em dia')
    const api6 = await fetch(url('/api/assinatura'), { headers: { cookie: j.header() } })
    const d6 = await api6.json().catch(() => ({}))
    checar('estado ATIVA com acesso', d6?.estado?.status === 'ATIVA' && d6?.estado?.temAcesso === true,
      d6?.estado?.motivo)
    checar('assinatura vinculada', !!d6?.assinatura?.subscriptionId)

    // ── 7. A RÉGUA NÃO MEXE EM QUEM ESTÁ EM DIA
    console.log('\n[7] Job diário não avisa nem corta quem está em dia')
    const seg = (process.env.CRON_SECRET || '').trim()
    if (!seg) { checar('CRON_SECRET disponível', false, 'ausente no env local'); }
    else {
      const cron = await fetch(url('/api/cron/assinaturas?dryRun=1'), {
        method: 'POST', headers: { authorization: `Bearer ${seg}` } })
      const bc = await cron.json().catch(() => ({}))
      checar('cron autenticado', cron.status === 200, `status=${cron.status}`)
      const meus = (bc.avisos ?? []).filter(a => a.workspaceId === wsId)
      checar('nenhum aviso para quem está ATIVA', meus.length === 0, JSON.stringify(meus))
      checar('não está na lista de corte', !(bc.cortadas ?? []).some(c => c.workspaceId === wsId))
    }

  } finally {
    console.log('\n[limpeza]')
    if (wsId) {
      await prisma.$executeRawUnsafe(`DELETE FROM "AssinaturaAviso" WHERE "workspaceId" = $1`, wsId)
      await prisma.$executeRawUnsafe(`DELETE FROM "AsaasCobranca" WHERE "workspaceId" = $1`, wsId)
      await prisma.$executeRawUnsafe(`DELETE FROM "AsaasAssinatura" WHERE "workspaceId" = $1`, wsId)
      await prisma.$executeRawUnsafe(`DELETE FROM "AsaasCliente" WHERE "workspaceId" = $1`, wsId)
      await prisma.$executeRawUnsafe(`DELETE FROM "WorkspaceTheme" WHERE "workspaceId" = $1`, wsId)
      await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE "workspaceId" = $1`, wsId)
      await prisma.$executeRawUnsafe(`DELETE FROM "Workspace" WHERE "id" = $1`, wsId)
    }
    await prisma.$executeRawUnsafe(`DELETE FROM "AsaasWebhookEvento" WHERE "eventoId" LIKE 'evt_teste_%'`)
    console.log('  🧹 limpo')
  }

  console.log(`\n${falhas === 0 ? '✅ FUNIL COMPLETO PASSOU' : `❌ ${falhas} falha(s)`}\n`)
  process.exitCode = falhas === 0 ? 0 : 1
}

main().catch(e => { console.error('\n❌ Erro:', e.message, '\n'); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
