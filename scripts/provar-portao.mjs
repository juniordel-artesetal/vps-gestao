// ─────────────────────────────────────────────────────────────────────────────
// PROVA DO NOVO PORTÃO — cadastro → plano+CPF → checkout → acesso.
//
//   PREVIEW_URL=https://<preview>.vercel.app \
//   node --env-file=.env --env-file=.env.local scripts/provar-portao.mjs
//
// Cobre os dois métodos (cartão e Pix) e o caminho do ABANDONO, que é o furo
// mais provável do funil.
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'
import crypto from 'node:crypto'

const prisma = new PrismaClient()
const BASE = (process.env.PREVIEW_URL || '').replace(/\/+$/, '')
const BYPASS = (process.env.VERCEL_BYPASS_SECRET || '').trim()
const TOKEN_WH = (process.env.WEBHOOK_TOKEN_PREVIEW || '').trim()
const CRON = (process.env.CRON_SECRET || '').trim()
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
async function cadastrar(chave) {
  const email = `${chave}.${marca}@teste-soa.local`
  const r = await fetch(url('/api/auth/register'), {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nome: 'Maria', email, senha: SENHA, nomeNegocio: `Ateliê ${chave} ${marca}` }) })
  const b = await r.json().catch(() => ({}))
  return { email, wsId: b.workspaceId, body: b }
}
const evento = (corpo) => fetch(url('/api/webhooks/asaas'), {
  method: 'POST', headers: { 'content-type': 'application/json', 'asaas-access-token': TOKEN_WH },
  body: JSON.stringify({ id: 'evt_teste_' + crypto.randomBytes(8).toString('hex'), ...corpo }) })
const lerWs = async (id) => (await prisma.$queryRawUnsafe(
  `SELECT "assinaturaStatus","ativo","trialAte","checkoutId","checkoutLink","metodoEscolhido","planoEscolhido"
   FROM "Workspace" WHERE "id"=$1`, id))[0]

async function main() {
  console.log('\n=== PROVA DO NOVO PORTÃO ===\n')
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
  console.log(`Banco:   ${host}\nPreview: ${BASE}\n`)
  if (host.includes('ep-lively-firefly')) { console.error('❌ PRODUÇÃO\n'); process.exitCode = 1; return }

  const criados = []
  try {
    // ── 1. CADASTRO não dá mais acesso
    console.log('[1] Cadastro cria conta SEM acesso e SEM trial')
    const a = await cadastrar('cartao'); criados.push(a.wsId)
    checar('conta criada', !!a.wsId, JSON.stringify(a.body).slice(0, 100))
    checar('resposta sinaliza aguardando', a.body.aguardandoPagamento === true)
    const w1 = await lerWs(a.wsId)
    checar('status AGUARDANDO_PAGAMENTO', w1?.assinaturaStatus === 'AGUARDANDO_PAGAMENTO', w1?.assinaturaStatus)
    checar('SEM trial ainda', w1?.trialAte === null)
    checar('ativo=true (precisa poder logar)', w1?.ativo === true)

    // ── 2. Ela loga, MAS não tem acesso
    console.log('\n[2] Ela consegue logar, mas cai na tela de pagamento')
    const j = await logar(a.email)
    checar('login funciona', !!j)
    const api = await fetch(url('/api/assinatura'), { headers: { cookie: j.header() } })
    const d2 = await api.json().catch(() => ({}))
    checar('estado sem acesso', d2?.estado?.temAcesso === false, d2?.estado?.motivo)
    checar('motivo é claro', String(d2?.estado?.motivo).includes('Aguardando'), d2?.estado?.motivo)

    // O DESTINO do portão: uma área guardada tem de jogá-la para /assinatura. É
    // exatamente para onde o /register manda a conta AGUARDANDO_PAGAMENTO (o fix
    // do redirect). O /setup NÃO é guardado — mandar para lá era o furo.
    const guardada = await fetch(url('/dashboard'), { headers: { cookie: j.header() }, redirect: 'manual' })
    const destino = guardada.headers.get('location') ?? ''
    checar('área guardada redireciona para /assinatura', guardada.status >= 300 && guardada.status < 400 && destino.includes('/assinatura'),
      `status=${guardada.status} location=${destino || '—'}`)

    // ── 3. Gera o checkout (CARTÃO, mensal)
    console.log('\n[3] Escolhe plano + CPF → checkout do Asaas (CARTÃO)')
    const r3 = await fetch(url('/api/assinatura/checkout'), {
      method: 'POST', headers: { cookie: j.header(), 'content-type': 'application/json' },
      body: JSON.stringify({ plano: 'mensal', metodo: 'cartao', cpf: CPF_OK }) })
    const b3 = await r3.json().catch(() => ({}))
    checar('checkout criado', r3.status === 200 && !!b3.link, b3.link || JSON.stringify(b3))
    if (b3.link) console.log(`     🔗 ${b3.link}`)
    const w3 = await lerWs(a.wsId)
    checar('vínculo gravado', !!w3?.checkoutId && w3?.metodoEscolhido === 'cartao' && w3?.planoEscolhido === 'mensal',
      `${w3?.metodoEscolhido}/${w3?.planoEscolhido}`)

    // ── 4. CHECKOUT_PAID → trial começa AGORA
    console.log('\n[4] CHECKOUT_PAID → trial de 14 dias começa')
    const ev = await evento({ event: 'CHECKOUT_PAID', checkout: { id: w3.checkoutId, status: 'PAID' } })
    checar('webhook aceitou', ev.status === 200, String(ev.status))
    const w4 = await lerWs(a.wsId)
    checar('status TRIAL', w4?.assinaturaStatus === 'TRIAL', w4?.assinaturaStatus)
    checar('trial de 14 dias', !!w4?.trialAte &&
      Math.round((new Date(w4.trialAte) - new Date().setHours(0, 0, 0, 0)) / 86400000) === 14)
    checar('link do checkout limpo', w4?.checkoutLink === null)
    const api4 = await fetch(url('/api/assinatura'), { headers: { cookie: j.header() } })
    checar('agora tem acesso', (await api4.json())?.estado?.temAcesso === true)

    // ── 5. Reprocessar não estende o trial
    console.log('\n[5] Reprocessar CHECKOUT_PAID não estende o trial')
    const antes = (await lerWs(a.wsId)).trialAte
    await evento({ event: 'CHECKOUT_PAID', checkout: { id: w3.checkoutId, status: 'PAID' } })
    checar('trialAte inalterado', String((await lerWs(a.wsId)).trialAte) === String(antes))

    // ── 6. PIX segue outro regime
    console.log('\n[6] PIX: cobrança única, não assinatura recorrente')
    const p = await cadastrar('pix'); criados.push(p.wsId)
    const jp = await logar(p.email)
    const r6 = await fetch(url('/api/assinatura/checkout'), {
      method: 'POST', headers: { cookie: jp.header(), 'content-type': 'application/json' },
      body: JSON.stringify({ plano: 'mensal', metodo: 'pix', cpf: CPF_OK }) })
    const b6 = await r6.json().catch(() => ({}))
    checar('checkout Pix criado', r6.status === 200 && !!b6.link, b6.link || JSON.stringify(b6))
    const w6 = await lerWs(p.wsId)
    checar('método gravado como pix', w6?.metodoEscolhido === 'pix')

    // ── 7. ABANDONO — o furo do funil
    console.log('\n[7] Abandono: link expira, conta sobrevive, ela gera outro')
    const ab = await cadastrar('abandono'); criados.push(ab.wsId)
    const jab = await logar(ab.email)
    const r7 = await fetch(url('/api/assinatura/checkout'), {
      method: 'POST', headers: { cookie: jab.header(), 'content-type': 'application/json' },
      body: JSON.stringify({ plano: 'anual', metodo: 'cartao', cpf: CPF_OK }) })
    const w7 = await lerWs(ab.wsId)
    checar('primeiro link gerado', !!(await r7.json()).link)

    await evento({ event: 'CHECKOUT_EXPIRED', checkout: { id: w7.checkoutId, status: 'EXPIRED' } })
    const w7b = await lerWs(ab.wsId)
    checar('link morto após EXPIRED', w7b?.checkoutLink === null)
    checar('conta NÃO foi apagada nem cortada', w7b?.assinaturaStatus === 'AGUARDANDO_PAGAMENTO', w7b?.assinaturaStatus)

    const r7c = await fetch(url('/api/assinatura/checkout'), {
      method: 'POST', headers: { cookie: jab.header(), 'content-type': 'application/json' },
      body: JSON.stringify({ plano: 'anual', metodo: 'cartao', cpf: CPF_OK }) })
    const b7c = await r7c.json().catch(() => ({}))
    checar('ela gera um link NOVO sozinha', r7c.status === 200 && !!b7c.link)
    checar('checkoutId mudou', (await lerWs(ab.wsId))?.checkoutId !== w7.checkoutId)

    // ── 8. Follow-up do lead: os 4 toques, contra o job de verdade
    console.log('\n[8] Follow-up do lead — 4 toques no job real')
    if (!CRON) checar('CRON_SECRET', false)
    else {
      const rodar = async (intervalo) => {
        await prisma.$executeRawUnsafe(
          `UPDATE "Workspace" SET "checkoutCriadoEm" = NOW() - INTERVAL '${intervalo}' WHERE "id"=$1`, ab.wsId)
        const c = await (await fetch(url('/api/cron/assinaturas?dryRun=1'), {
          method: 'POST', headers: { authorization: `Bearer ${CRON}` } })).json()
        return {
          avisos: (c.avisos ?? []).filter(x => x.workspaceId === ab.wsId).map(x => x.tipo),
          cortadas: (c.cortadas ?? []).some(x => x.workspaceId === ab.wsId),
        }
      }
      const t1 = await rodar('1 hour 5 minutes')
      checar('1º toque (+1h)', t1.avisos.includes('CHECKOUT_ABANDONADO_1H'), t1.avisos.join(','))
      const t2 = await rodar('23 hours 10 minutes')
      checar('2º toque (+23h)', t2.avisos.includes('CHECKOUT_ABANDONADO_23H'), t2.avisos.join(','))
      const t3 = await rodar('48 hours 20 minutes')
      checar('3º toque (+2 dias)', t3.avisos.includes('CHECKOUT_ABANDONADO_D2'), t3.avisos.join(','))
      const t4 = await rodar('144 hours 30 minutes')
      checar('4º toque (+6 dias)', t4.avisos.includes('CHECKOUT_ABANDONADO_D6'), t4.avisos.join(','))
      checar('lead NUNCA entra no corte', !t1.cortadas && !t2.cortadas && !t3.cortadas && !t4.cortadas)
      const t5 = await rodar('40 hours')
      checar('silêncio entre os toques', t5.avisos.length === 0, t5.avisos.join(','))
      const t6 = await rodar('200 hours')
      checar('após o 4º toque sai da varredura', t6.avisos.length === 0, t6.avisos.join(','))
    }

    // ── 9. A lead aparece no Master com o último toque
    console.log('\n[9] Master enxerga a lead')
    const MASTER = (process.env.MASTER_SECRET_TOKEN || '').trim()
    await prisma.$executeRawUnsafe(
      `UPDATE "Workspace" SET "checkoutCriadoEm" = NOW() - INTERVAL '3 hours' WHERE "id"=$1`, ab.wsId)
    const m = await (await fetch(url('/api/master/assinaturas'), {
      headers: { cookie: `master_token=${MASTER}` } })).json()
    const lead = (m.leads ?? []).find(x => x.workspaceId === ab.wsId)
    checar('lead na lista', !!lead, lead?.workspace)
    checar('mostra o e-mail para contato', !!lead?.email, lead?.email)
    checar('mostra o que ela escolheu', lead?.planoEscolhido === 'anual' && lead?.metodoEscolhido === 'cartao',
      `${lead?.planoEscolhido}/${lead?.metodoEscolhido}`)
    checar('mostra há quanto tempo está parada', typeof lead?.horasParada === 'number',
      `${Math.floor(lead?.horasParada ?? -1)}h`)
    checar('segmento aparece (vazio, como esperado)', 'segmento' in (lead ?? {}))
    checar('total de leads contabilizado', typeof m.totais?.leads === 'number', String(m.totais?.leads))

  } finally {
    console.log('\n[limpeza]')
    for (const id of criados.filter(Boolean)) {
      for (const t of ['AssinaturaAviso', 'AsaasCobranca', 'AsaasAssinatura', 'AsaasCliente', 'WorkspaceTheme', 'User']) {
        await prisma.$executeRawUnsafe(`DELETE FROM "${t}" WHERE "workspaceId"=$1`, id).catch(() => {})
      }
      await prisma.$executeRawUnsafe(`DELETE FROM "Workspace" WHERE "id"=$1`, id)
    }
    await prisma.$executeRawUnsafe(`DELETE FROM "AsaasWebhookEvento" WHERE "eventoId" LIKE 'evt_teste_%'`)
    console.log('  🧹 limpo')
  }

  console.log(`\n${falhas === 0 ? '✅ NOVO PORTÃO PASSOU' : `❌ ${falhas} falha(s)`}\n`)
  process.exitCode = falhas === 0 ? 0 : 1
}

main().catch(e => { console.error('\n❌ Erro:', e.message, '\n'); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
