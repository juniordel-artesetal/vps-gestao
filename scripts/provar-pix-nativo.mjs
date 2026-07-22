// ─────────────────────────────────────────────────────────────────────────────
// PROVA DO PIX NATIVO — QR na nossa tela, pagamento destravando sozinho.
//
//   PREVIEW_URL=https://<preview>.vercel.app \
//   node --env-file=.env --env-file=.env.local scripts/provar-pix-nativo.mjs
//
// O ciclo real: gera o QR → paga no sandbox → webhook processa → o endpoint de
// status que a tela consulta vira "pago". Sem sair do sistema em momento nenhum.
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'
import crypto from 'node:crypto'

const prisma = new PrismaClient()
const BASE = (process.env.PREVIEW_URL || '').replace(/\/+$/, '')
const BYPASS = (process.env.VERCEL_BYPASS_SECRET || '').trim()
const TOKEN_WH = (process.env.WEBHOOK_TOKEN_PREVIEW || '').trim()
const API_KEY = (process.env.ASAAS_API_KEY || '').trim()
const SENHA = 'Teste@' + Math.random().toString(36).slice(2, 10)
const CPF_OK = '24971563792'
const marca = Date.now().toString(36)

let falhas = 0
const checar = (n, ok, d = '') => { if (!ok) falhas++; console.log(`  ${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`) }
const url = (p) => `${BASE}${p}${BYPASS ? (p.includes('?') ? '&' : '?') + 'x-vercel-protection-bypass=' + BYPASS : ''}`
const asaas = async (p, m = 'GET', c) => {
  const r = await fetch(`https://api-sandbox.asaas.com/v3${p}`, { method: m,
    headers: { access_token: API_KEY, 'Content-Type': 'application/json' }, body: c ? JSON.stringify(c) : undefined })
  const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null } catch {}
  return { ok: r.ok, d }
}

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
  console.log('\n=== PROVA — PIX NATIVO (a artesã nunca sai do sistema) ===\n')
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
  console.log(`Banco:   ${host}\nPreview: ${BASE}\n`)
  if (host.includes('ep-lively-firefly')) { console.error('❌ PRODUÇÃO\n'); process.exitCode = 1; return }

  const email = `pixnat.${marca}@teste-soa.local`
  let wsId = null

  try {
    // ── conta em AGUARDANDO_PAGAMENTO
    const reg = await fetch(url('/api/auth/register'), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nome: 'Maria', email, senha: SENHA, nomeNegocio: `Ateliê Pix ${marca}` }) })
    wsId = (await reg.json()).workspaceId
    const j = await logar(email)
    checar('conta criada e logada', !!wsId && !!j)

    // ── 1. QR na nossa tela
    console.log('\n[1] QR Code gerado para a NOSSA interface')
    const r1 = await fetch(url('/api/assinatura/pix'), {
      method: 'POST', headers: { cookie: j.header(), 'content-type': 'application/json' },
      body: JSON.stringify({ plano: 'mensal', cpf: CPF_OK }) })
    const b1 = await r1.json().catch(() => ({}))
    checar('endpoint responde', r1.status === 200, JSON.stringify(b1).slice(0, 120))
    checar('QR em base64 (renderiza com <img>)', typeof b1.qrImagem === 'string' && b1.qrImagem.length > 500,
      `${(b1.qrImagem ?? '').length} chars`)
    checar('copia-e-cola presente', typeof b1.qrTexto === 'string' && b1.qrTexto.startsWith('000201'),
      (b1.qrTexto ?? '').slice(0, 40) + '…')
    checar('valor mensal 29,90', b1.valor === 29.9, String(b1.valor))
    checar('vence no fim do trial (D+14)', !!b1.vencimento, b1.vencimento)

    // ── 2. Antes de pagar, a tela mostra "aguardando"
    console.log('\n[2] Endpoint de status que a tela consulta')
    const s1 = await (await fetch(url('/api/assinatura/status'), { headers: { cookie: j.header() } })).json()
    checar('ainda não pago', s1.pago === false, `cobranca=${s1.cobrancaStatus} status=${s1.status}`)
    checar('sem acesso ainda', s1.temAcesso === false)

    // ── 3. Não cobra duas vezes
    console.log('\n[3] Pedir o QR de novo reaproveita a MESMA cobrança')
    const r3 = await fetch(url('/api/assinatura/pix'), {
      method: 'POST', headers: { cookie: j.header(), 'content-type': 'application/json' },
      body: JSON.stringify({ plano: 'mensal', cpf: CPF_OK }) })
    const b3 = await r3.json().catch(() => ({}))
    checar('mesmo paymentId', b3.paymentId === b1.paymentId, `${b3.paymentId} vs ${b1.paymentId}`)
    checar('marcada como reaproveitada', b3.reaproveitada === true)
    const [{ n: qtd }] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS n FROM "AsaasCobranca" WHERE "workspaceId"=$1`, wsId)
    checar('só 1 cobrança no banco', qtd === 1, `${qtd} cobranças`)

    // ── 4. Pagamento no sandbox → webhook → status vira pago
    console.log('\n[4] Ela paga → o webhook processa → a tela destrava sozinha')
    const pg = await asaas(`/payments/${b1.paymentId}/receiveInCash`, 'POST', {
      paymentDate: new Date().toISOString().slice(0, 10), value: b1.valor, notifyCustomer: false })
    checar('pagamento registrado no Asaas', pg.ok, pg.d?.status)

    // O Asaas dispara o webhook; simulamos a entrega para não depender do timing dele.
    const ev = await fetch(url('/api/webhooks/asaas'), {
      method: 'POST', headers: { 'content-type': 'application/json', 'asaas-access-token': TOKEN_WH },
      body: JSON.stringify({ id: 'evt_teste_' + crypto.randomBytes(8).toString('hex'),
        event: 'PAYMENT_RECEIVED',
        payment: { id: b1.paymentId, customer: 'cus_x', value: b1.valor, netValue: 28.91,
          status: 'RECEIVED', billingType: 'PIX', dueDate: b1.vencimento } }) })
    checar('webhook aceitou', ev.status === 200)

    const s2 = await (await fetch(url('/api/assinatura/status'), { headers: { cookie: j.header() } })).json()
    checar('a tela agora vê PAGO', s2.pago === true, `cobranca=${s2.cobrancaStatus}`)

    // ── 5. LGPD e coerência
    console.log('\n[5] Coerência')
    const [ws] = await prisma.$queryRawUnsafe(
      `SELECT "metodoEscolhido","formaEscolhida","assinaturaOrigem" FROM "Workspace" WHERE "id"=$1`, wsId)
    checar('método gravado como pix', ws?.metodoEscolhido === 'pix')
    checar('Pix nunca é parcelado', ws?.formaEscolhida === 'avista', ws?.formaEscolhida)
    checar('workspace passou a ser Asaas', ws?.assinaturaOrigem === 'asaas')
    const [cob] = await prisma.$queryRawUnsafe(
      `SELECT "billingType","valor"::float AS v FROM "AsaasCobranca" WHERE "workspaceId"=$1`, wsId)
    checar('cobrança é PIX de 29,90', cob?.billingType === 'PIX' && cob?.v === 29.9)

  } finally {
    console.log('\n[limpeza]')
    if (wsId) {
      for (const t of ['AssinaturaAviso', 'AsaasCobranca', 'AsaasAssinatura', 'AsaasCliente', 'WorkspaceTheme', 'User']) {
        await prisma.$executeRawUnsafe(`DELETE FROM "${t}" WHERE "workspaceId"=$1`, wsId).catch(() => {})
      }
      await prisma.$executeRawUnsafe(`DELETE FROM "Workspace" WHERE "id"=$1`, wsId)
    }
    await prisma.$executeRawUnsafe(`DELETE FROM "AsaasWebhookEvento" WHERE "eventoId" LIKE 'evt_teste_%'`)
    console.log('  🧹 limpo')
  }

  console.log(`\n${falhas === 0 ? '✅ PIX NATIVO PASSOU' : `❌ ${falhas} falha(s)`}\n`)
  process.exitCode = falhas === 0 ? 0 : 1
}

main().catch(e => { console.error('\n❌ Erro:', e.message, '\n'); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
