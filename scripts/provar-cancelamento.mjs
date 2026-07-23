// ─────────────────────────────────────────────────────────────────────────────
// PROVA da Etapa 7 — cancelamento e visão do Master.
//
//   PREVIEW_URL=https://<preview>.vercel.app \
//   node --env-file=.env --env-file=.env.local scripts/provar-cancelamento.mjs
//
// Prova exigida na revisão: cancelar mantendo acesso até o fim do ciclo · Master
// vendo falha de split COM o motivo · CANCELADA não recebe e-mail nem corte.
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'

const prisma = new PrismaClient()
const BASE = (process.env.PREVIEW_URL || '').replace(/\/+$/, '')
const BYPASS = (process.env.VERCEL_BYPASS_SECRET || '').trim()
const MASTER = (process.env.MASTER_SECRET_TOKEN || '').trim()
const CRON = (process.env.CRON_SECRET || '').trim()
const SENHA = 'Teste@' + Math.random().toString(36).slice(2, 10)
const CPF_OK = '24971563792'
const marca = Date.now().toString(36)

let falhas = 0
const checar = (n, ok, d = '') => { if (!ok) falhas++; console.log(`  ${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`) }
const url = (p) => `${BASE}${p}${BYPASS ? (p.includes('?') ? '&' : '?') + 'x-vercel-protection-bypass=' + BYPASS : ''}`
const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

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
const master = (p, init = {}) => fetch(url(p), { ...init, headers: { ...(init.headers ?? {}), cookie: `master_token=${MASTER}` } })

const lerWs = async (id) => (await prisma.$queryRawUnsafe(
  `SELECT "assinaturaStatus","ativo","assinaturaExpira" FROM "Workspace" WHERE "id"=$1`, id))[0]

async function main() {
  console.log('\n=== PROVA — Etapa 7: cancelamento + Master ===\n')
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
  console.log(`Banco:   ${host}\nPreview: ${BASE}\n`)
  if (!BASE || !MASTER) { console.error('❌ Falta PREVIEW_URL/MASTER_SECRET_TOKEN\n'); process.exitCode = 1; return }
  if (host.includes('ep-lively-firefly')) { console.error('❌ PRODUÇÃO\n'); process.exitCode = 1; return }

  const email = `cancel.${marca}@teste-soa.local`
  let wsId = null

  try {
    // ── Conta assinante, já ATIVA e com ciclo pago até daqui a 20 dias
    console.log('[1] Assinante ATIVA cancela e MANTÉM acesso até o fim do ciclo')
    const r0 = await fetch(url('/api/auth/register'), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nome: 'Maria', email, senha: SENHA, nomeNegocio: `Ateliê Cancel ${marca}` }) })
    wsId = (await r0.json()).workspaceId
    const j = await logar(email)
    const ass = await (await fetch(url('/api/assinatura/assinar'), {
      method: 'POST', headers: { cookie: j.header(), 'content-type': 'application/json' },
      body: JSON.stringify({ cpf: CPF_OK, plano: 'mensal' }) })).json()
    checar('assinatura criada', !!ass.subscriptionId, ass.subscriptionId)

    // Simula ciclo pago vencendo em 20 dias
    const fim = new Date(); fim.setDate(fim.getDate() + 20)
    await prisma.$executeRawUnsafe(
      `UPDATE "Workspace" SET "assinaturaStatus"='ATIVA', "assinaturaExpira"=$2 WHERE "id"=$1`, wsId, fim)

    const rc = await fetch(url('/api/assinatura/cancelar'), {
      method: 'POST', headers: { cookie: j.header(), 'content-type': 'application/json' }, body: '{}' })
    const bc = await rc.json().catch(() => ({}))
    checar('cancelamento aceito', rc.status === 200 && bc.ok === true, JSON.stringify(bc).slice(0, 150))
    checar('estado vira CANCELADA', bc?.estado?.status === 'CANCELADA', bc?.estado?.status)
    checar('MAS mantém acesso (ciclo pago)', bc?.estado?.temAcesso === true, bc?.estado?.motivo)

    const [a1] = await prisma.$queryRawUnsafe(
      `SELECT "status","canceladaPor","canceladaEm" FROM "AsaasAssinatura" WHERE "workspaceId"=$1`, wsId)
    checar('assinatura marcada CANCELADA', a1?.status === 'CANCELADA')
    checar('rastro de quem cancelou', a1?.canceladaPor === 'assinante' && !!a1?.canceladaEm, a1?.canceladaPor)

    // ── Navegação continua liberada.
    // Re-login de propósito: a revalidação do JWT é throttled a 15 min (auth.ts),
    // e esta conta logou AINDA em AGUARDANDO (bloqueada) antes de virar ATIVA no
    // teste. No mundo real quem cancela já tinha sessão ATIVA (não bloqueada); aqui
    // um login novo dá um token que revalida na hora e reflete CANCELADA + acesso.
    const j2 = await logar(email)
    const nav = await fetch(url('/dashboard'), { headers: { cookie: j2.header() }, redirect: 'manual' })
    checar('dashboard continua abrindo', nav.status === 200, `status=${nav.status}`)

    // ── Depois do fim do ciclo, o acesso cai sozinho (regra calculada)
    console.log('\n[2] Passado o fim do ciclo, o acesso cai sozinho')
    const ontem = new Date(); ontem.setDate(ontem.getDate() - 1)
    await prisma.$executeRawUnsafe(`UPDATE "Workspace" SET "assinaturaExpira"=$2 WHERE "id"=$1`, wsId, ontem)
    const api2 = await fetch(url('/api/assinatura'), { headers: { cookie: j.header() } })
    const d2 = await api2.json().catch(() => ({}))
    checar('sem acesso após o período', d2?.estado?.temAcesso === false, d2?.estado?.motivo)

    // ── A régua ignora quem cancelou
    console.log('\n[3] CANCELADA não recebe e-mail nem corte')
    if (!CRON) checar('CRON_SECRET disponível', false)
    else {
      const cron = await fetch(url('/api/cron/assinaturas?dryRun=1'), {
        method: 'POST', headers: { authorization: `Bearer ${CRON}` } })
      const bcron = await cron.json().catch(() => ({}))
      checar('cron rodou', cron.status === 200)
      checar('nenhum aviso para a cancelada',
        !(bcron.avisos ?? []).some(a => a.workspaceId === wsId), JSON.stringify((bcron.avisos ?? []).filter(a => a.workspaceId === wsId)))
      checar('não entra na lista de corte',
        !(bcron.cortadas ?? []).some(c => c.workspaceId === wsId))
    }

    // ── Master vê tudo
    console.log('\n[4] Master enxerga a assinatura e a falha de split')
    const m = await (await master('/api/master/assinaturas')).json()
    const minha = (m.assinaturas ?? []).find(a => a.workspaceId === wsId)
    checar('assinatura aparece na lista', !!minha, minha?.status)
    checar('mostra quem cancelou', minha?.canceladaPor === 'assinante')
    checar('totais batem', typeof m.totais?.total === 'number', JSON.stringify(m.totais))
    checar('bloco de falhas de split existe', Array.isArray(m.falhasSplit))

    // Falha de split COM motivo — exigência da revisão
    const wsSplit = `wsteste_split_${marca}`
    const pId = `ptest_split_${marca}`
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Workspace" ("id","nome","slug","plano","ativo","assinaturaStatus","assinaturaOrigem")
       VALUES ($1,'Ateliê Split Falho',$1,'TRIAL',true,'TRIAL','asaas')`, wsSplit)
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Parceiro" ("id","tipo","nome","ativo","comissaoPercMensal","comissaoPercAnual","comissaoRecorrente","walletId","createdAt")
       VALUES ($1,'influencer','Influencer Falha',true,30,40,true,'wallet-invalida',NOW())`, pId)
    await prisma.$executeRawUnsafe(
      `INSERT INTO "AsaasAssinatura" ("id","workspaceId","subscriptionId","sandbox","ciclo","valor","status","parceiroId","splitErro","createdAt","updatedAt")
       VALUES ($1,$2,$3,true,'MONTHLY',29.90,'ACTIVE',$4,'Wallet [wallet-invalida] inexistente.',NOW(),NOW())`,
      gerarId(), wsSplit, 'sub_falha_' + marca, pId)

    const m2 = await (await master('/api/master/assinaturas')).json()
    const falha = (m2.falhasSplit ?? []).find(f => f.workspaceId === wsSplit)
    checar('falha de split VISÍVEL no Master', !!falha, falha?.workspace)
    checar('com o MOTIVO gravado', (falha?.splitErro ?? '').includes('inexistente'), falha?.splitErro)
    checar('identifica o parceiro a pagar na mão', falha?.parceiro === 'Influencer Falha', falha?.parceiro)

    // ── Master libera e cancela
    console.log('\n[5] Ações do Master')
    const lib = await master('/api/master/assinaturas', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ acao: 'liberar', workspaceId: wsSplit, motivo: 'teste' }) })
    checar('liberar responde ok', lib.status === 200)
    const [wl] = await prisma.$queryRawUnsafe(`SELECT "liberacaoManual" FROM "Workspace" WHERE "id"=$1`, wsSplit)
    checar('liberacaoManual gravada', wl?.liberacaoManual === true)

    const semAuth = await fetch(url('/api/master/assinaturas'))
    checar('sem master_token → 401', semAuth.status === 401, `status=${semAuth.status}`)

    // ── Webhook SUBSCRIPTION_DELETED reflete
    console.log('\n[6] SUBSCRIPTION_DELETED vindo do Asaas reflete aqui')
    const wsEv = `wsteste_ev_${marca}`
    const subEv = 'sub_ev_' + marca
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Workspace" ("id","nome","slug","plano","ativo","assinaturaStatus","assinaturaOrigem")
       VALUES ($1,'Ateliê Evento',$1,'TRIAL',true,'ATIVA','asaas')`, wsEv)
    await prisma.$executeRawUnsafe(
      `INSERT INTO "AsaasAssinatura" ("id","workspaceId","subscriptionId","sandbox","ciclo","valor","status","createdAt","updatedAt")
       VALUES ($1,$2,$3,true,'MONTHLY',29.90,'ACTIVE',NOW(),NOW())`, gerarId(), wsEv, subEv)

    const ev = await fetch(url('/api/webhooks/asaas'), {
      method: 'POST', headers: { 'content-type': 'application/json', 'asaas-access-token': process.env.WEBHOOK_TOKEN_PREVIEW },
      body: JSON.stringify({ id: 'evt_teste_' + crypto.randomBytes(8).toString('hex'),
        event: 'SUBSCRIPTION_DELETED', subscription: { id: subEv, status: 'INACTIVE' } }) })
    checar('webhook aceitou', ev.status === 200)
    const [wev] = await prisma.$queryRawUnsafe(`SELECT "assinaturaStatus" FROM "Workspace" WHERE "id"=$1`, wsEv)
    checar('workspace refletiu CANCELADA', wev?.assinaturaStatus === 'CANCELADA', wev?.assinaturaStatus)

  } finally {
    console.log('\n[limpeza]')
    for (const t of ['AssinaturaAviso', 'AsaasCobranca', 'AsaasAssinatura', 'AsaasCliente', 'WorkspaceTheme', 'User']) {
      await prisma.$executeRawUnsafe(`DELETE FROM "${t}" WHERE "workspaceId" LIKE 'wsteste_%'`).catch(() => {})
    }
    await prisma.$executeRawUnsafe(`DELETE FROM "ParceiroComissao" WHERE "workspaceId" LIKE 'wsteste_%'`).catch(() => {})
    await prisma.$executeRawUnsafe(`DELETE FROM "Parceiro" WHERE "id" LIKE 'ptest_%'`).catch(() => {})
    await prisma.$executeRawUnsafe(`DELETE FROM "Workspace" WHERE "id" LIKE 'wsteste_%'`)
    if (wsId) {
      for (const t of ['AssinaturaAviso', 'AsaasCobranca', 'AsaasAssinatura', 'AsaasCliente', 'WorkspaceTheme', 'User']) {
        await prisma.$executeRawUnsafe(`DELETE FROM "${t}" WHERE "workspaceId"=$1`, wsId).catch(() => {})
      }
      await prisma.$executeRawUnsafe(`DELETE FROM "Workspace" WHERE "id"=$1`, wsId)
    }
    await prisma.$executeRawUnsafe(`DELETE FROM "AsaasWebhookEvento" WHERE "eventoId" LIKE 'evt_teste_%'`)
    console.log('  🧹 limpo')
  }

  console.log(`\n${falhas === 0 ? '✅ TODAS as provas passaram' : `❌ ${falhas} falha(s)`}\n`)
  process.exitCode = falhas === 0 ? 0 : 1
}

main().catch(e => { console.error('\n❌ Erro:', e.message, '\n'); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
