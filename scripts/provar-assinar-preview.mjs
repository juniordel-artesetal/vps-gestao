// ─────────────────────────────────────────────────────────────────────────────
// PROVA da Etapa 3 — assinar de verdade, com sessão real, no preview + sandbox.
//
// Cobre os dois caminhos da regra de comissão:
//   • parceiro COM walletId  → split aplicado, snapshot gravado
//   • parceiro SEM walletId  → sem split (payout manual depois)
//   • sem parceiro           → sem split, sem erro
// E as recusas: CPF inválido, plano inválido, assinatura duplicada.
//
// USO:
//   PREVIEW_URL=https://<preview>.vercel.app \
//   node --env-file=.env --env-file=.env.local scripts/provar-assinar-preview.mjs
//
// ⚠️ Cria dados no SANDBOX do Asaas (clientes e assinaturas de teste) e no banco
//    DEV. Limpa o banco no fim; o que fica no sandbox é listado para remoção.
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const BASE = (process.env.PREVIEW_URL || '').replace(/\/+$/, '')
const BYPASS = (process.env.VERCEL_BYPASS_SECRET || '').trim()
const API_KEY = (process.env.ASAAS_API_KEY || '').trim()
const SENHA = 'Teste@' + Math.random().toString(36).slice(2, 10)

let falhas = 0
const checar = (nome, ok, det = '') => { if (!ok) falhas++; console.log(`  ${ok ? '✅' : '❌'} ${nome}${det ? ` — ${det}` : ''}`) }
const url = (p) => `${BASE}${p}${BYPASS ? (p.includes('?') ? '&' : '?') + 'x-vercel-protection-bypass=' + BYPASS : ''}`
const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const marca = Date.now().toString(36)

// CPFs fictícios com dígitos verificadores válidos (sandbox).
const CPF_OK = '24971563792'
const CPF_RUIM = '11111111111'

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
const assinar = async (j, corpo) => {
  const r = await fetch(url('/api/assinatura/assinar'), {
    method: 'POST', headers: { cookie: j.header(), 'content-type': 'application/json' },
    body: JSON.stringify(corpo) })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

async function criarConta(chave, { comWallet = false, semParceiro = false } = {}) {
  const ws = `wsteste_${chave}_${marca}`
  const email = `${chave}.${marca}@teste-soa.local`
  const hash = await bcrypt.hash(SENHA, 10)
  const trial = new Date(); trial.setDate(trial.getDate() + 5)

  await prisma.$executeRawUnsafe(
    `INSERT INTO "Workspace" ("id","nome","slug","plano","ativo","assinaturaStatus","trialAte")
     VALUES ($1,$2,$3,'TRIAL',true,'TRIAL',$4)`, ws, 'Ateliê ' + chave, ws, trial)
  await prisma.$executeRawUnsafe(
    `INSERT INTO "User" ("id","workspaceId","nome","email","senha","role","ativo")
     VALUES ($1,$2,'Teste',$3,$4,'ADMIN',true)`, gerarId(), ws, email, hash)

  let parceiroId = null
  if (!semParceiro) {
    parceiroId = `ptest_${chave}_${marca}`
    // walletId do sandbox: a própria carteira da conta serve para provar o
    // caminho — o Asaas recusa split para a wallet do dono, o que é ESPERADO e
    // não invalida a prova de que o split foi montado e gravado.
    const wallet = comWallet ? (process.env.ASAAS_WALLET_TESTE || 'ba72bf2f-d95d-4f53-9189-60cc2c433d2e') : null
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Parceiro" ("id","tipo","nome","ativo","comissaoPercMensal","comissaoPercAnual","comissaoRecorrente","walletId","createdAt")
       VALUES ($1,'influencer',$2,true,30,40,true,$3,NOW())`, parceiroId, 'Parceiro ' + chave, wallet)
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Lead" ("id","nome","telefone","email","origem","consentimento","parceiroId","status","workspaceId","createdAt")
       VALUES ($1,'Lead teste','','x@y.z','parceiro',true,$2,'trial',$3,NOW())`, gerarId(), parceiroId, ws)
  }
  return { ws, email, parceiroId }
}

async function main() {
  console.log('\n=== PROVA — Etapa 3: assinar (sessão real + sandbox) ===\n')
  if (!BASE) { console.error('❌ Falta PREVIEW_URL\n'); process.exitCode = 1; return }
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
  console.log(`Banco:   ${host}\nPreview: ${BASE}\n`)
  if (host.includes('ep-lively-firefly')) { console.error('❌ PRODUÇÃO — abortando\n'); process.exitCode = 1; return }
  if (!API_KEY.includes('_hmlg_')) { console.error('❌ chave não é sandbox\n'); process.exitCode = 1; return }

  const criados = []
  try {
    // ── [1] Parceiro COM walletId → split aplicado
    console.log('[1] Parceiro COM walletId — plano ANUAL (40%)')
    const a = await criarConta('comwallet', { comWallet: true }); criados.push(a)
    const ja = await logar(a.email)
    checar('login', !!ja)
    const r1 = await assinar(ja, { cpf: CPF_OK, plano: 'anual' })
    checar('assinatura criada', r1.status === 200 && !!r1.body.subscriptionId, r1.body.subscriptionId || JSON.stringify(r1.body))
    checar('plano anual', r1.body.plano === 'anual')
    checar('invoiceUrl devolvida', !!r1.body.invoiceUrl)
    if (r1.body.invoiceUrl) console.log(`     🔗 ${r1.body.invoiceUrl}`)

    const [sub1] = await prisma.$queryRawUnsafe(
      `SELECT "ciclo","valor"::float AS valor,"splitWalletId","splitValor"::float AS "splitValor","splitPercentual"::float AS perc,"parceiroId"
       FROM "AsaasAssinatura" WHERE "workspaceId" = $1`, a.ws)
    checar('ciclo YEARLY', sub1?.ciclo === 'YEARLY', sub1?.ciclo)
    checar('valor 240.40', sub1?.valor === 240.4, String(sub1?.valor))
    checar('snapshot do split gravado', !!sub1?.splitWalletId, `wallet=${sub1?.splitWalletId?.slice(0, 8)}… valor=${sub1?.splitValor} perc=${sub1?.perc}%`)
    checar('comissão = 40% de 240,40 = 96,16', sub1?.splitValor === 96.16, String(sub1?.splitValor))
    checar('parceiro vinculado', sub1?.parceiroId === a.parceiroId)

    const [cob1] = await prisma.$queryRawUnsafe(
      `SELECT "paymentId","invoiceUrl","valor"::float AS valor,"status" FROM "AsaasCobranca"
       WHERE "workspaceId" = $1 ORDER BY "createdAt" DESC LIMIT 1`, a.ws)
    checar('cobrança sincronizada com invoiceUrl', !!cob1?.invoiceUrl, `${cob1?.paymentId} R$${cob1?.valor} ${cob1?.status}`)

    const [ws1] = await prisma.$queryRawUnsafe(`SELECT "assinaturaOrigem" FROM "Workspace" WHERE "id" = $1`, a.ws)
    checar('workspace passou a ser governada pelo Asaas', ws1?.assinaturaOrigem === 'asaas', ws1?.assinaturaOrigem)

    // ── [2] Parceiro SEM walletId → sem split
    console.log('\n[2] Parceiro SEM walletId — plano MENSAL')
    const b = await criarConta('semwallet', { comWallet: false }); criados.push(b)
    const jb = await logar(b.email)
    const r2 = await assinar(jb, { cpf: CPF_OK, plano: 'mensal' })
    checar('assinatura criada', r2.status === 200 && !!r2.body.subscriptionId, r2.body.subscriptionId || JSON.stringify(r2.body))
    const [sub2] = await prisma.$queryRawUnsafe(
      `SELECT "ciclo","valor"::float AS valor,"splitWalletId","splitValor" FROM "AsaasAssinatura" WHERE "workspaceId" = $1`, b.ws)
    checar('ciclo MONTHLY', sub2?.ciclo === 'MONTHLY', sub2?.ciclo)
    checar('valor 29.90', sub2?.valor === 29.9, String(sub2?.valor))
    checar('SEM split (payout manual depois)', sub2?.splitWalletId === null && sub2?.splitValor === null)

    // ── [3] Sem parceiro nenhum
    console.log('\n[3] Sem parceiro atribuído')
    const c = await criarConta('semparc', { semParceiro: true }); criados.push(c)
    const jc = await logar(c.email)
    const r3 = await assinar(jc, { cpf: CPF_OK, plano: 'mensal' })
    checar('assinatura criada sem erro', r3.status === 200 && !!r3.body.subscriptionId)
    const [sub3] = await prisma.$queryRawUnsafe(
      `SELECT "splitWalletId","parceiroId" FROM "AsaasAssinatura" WHERE "workspaceId" = $1`, c.ws)
    checar('sem split e sem parceiro', sub3?.splitWalletId === null && sub3?.parceiroId === null)

    // ── [4] Recusas
    console.log('\n[4] Recusas (validação antes de chamar o Asaas)')
    const d = await criarConta('recusa', { semParceiro: true }); criados.push(d)
    const jd = await logar(d.email)
    const e1 = await assinar(jd, { cpf: CPF_RUIM, plano: 'mensal' })
    checar('CPF inválido → 400', e1.status === 400, e1.body.error)
    const e2 = await assinar(jd, { cpf: CPF_OK, plano: 'trimestral' })
    checar('plano inválido → 400', e2.status === 400, e2.body.error)
    const e3 = await assinar(jd, { cpf: CPF_OK, plano: 'mensal' })
    checar('assinatura válida passa', e3.status === 200)
    const e4 = await assinar(jd, { cpf: CPF_OK, plano: 'anual' })
    checar('segunda assinatura → 409 (não cobra duas vezes)', e4.status === 409, e4.body.error)

    // ── [5] LGPD
    console.log('\n[5] LGPD — o CPF não ficou em lugar nenhum')
    const vaz = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS n FROM "AsaasCliente" WHERE "nome" LIKE '%${CPF_OK}%' OR COALESCE("email",'') LIKE '%${CPF_OK}%'`)
    checar('CPF não está em AsaasCliente', vaz[0].n === 0)
    const vaz2 = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS n FROM "AsaasCobranca" WHERE COALESCE("referencia",'') LIKE '%${CPF_OK}%'`)
    checar('CPF não está em AsaasCobranca', vaz2[0].n === 0)

  } finally {
    console.log('\n[limpeza do banco DEV]')
    await prisma.$executeRawUnsafe(`DELETE FROM "AsaasCobranca"   WHERE "workspaceId" LIKE 'wsteste_%'`)
    await prisma.$executeRawUnsafe(`DELETE FROM "AsaasAssinatura" WHERE "workspaceId" LIKE 'wsteste_%'`)
    await prisma.$executeRawUnsafe(`DELETE FROM "AsaasCliente"    WHERE "workspaceId" LIKE 'wsteste_%'`)
    await prisma.$executeRawUnsafe(`DELETE FROM "Lead"            WHERE "workspaceId" LIKE 'wsteste_%'`)
    await prisma.$executeRawUnsafe(`DELETE FROM "Parceiro"        WHERE "id" LIKE 'ptest_%'`)
    await prisma.$executeRawUnsafe(`DELETE FROM "User"            WHERE "workspaceId" LIKE 'wsteste_%'`)
    await prisma.$executeRawUnsafe(`DELETE FROM "Workspace"       WHERE "id" LIKE 'wsteste_%'`)
    console.log('  🧹 limpo')
    console.log('  ℹ️  As assinaturas de teste continuam no SANDBOX do Asaas — remover depois.')
  }

  console.log(`\n${falhas === 0 ? '✅ TODAS as provas passaram' : `❌ ${falhas} falha(s)`}\n`)
  process.exitCode = falhas === 0 ? 0 : 1
}

main().catch(e => { console.error('\n❌ Erro:', e.message, '\n'); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
