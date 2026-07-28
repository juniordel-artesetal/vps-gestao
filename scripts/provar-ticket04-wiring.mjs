// SMOKE de wiring (preview) — o endpoint /api/assinatura/pix da indicada atribuída
// dispara a notificação à parceira (AssinaturaAviso PARCEIRA_SEGUIDORA_TRIAL),
// idempotente. Prova que o hook adicionado em pix.ts roda no build deployado.
//
//   PREVIEW_URL=https://... node --experimental-strip-types --import ./scripts/_loader-alias.mjs \
//     --env-file=.env --env-file=.env.local scripts/provar-ticket04-wiring.mjs
import { prisma } from '../lib/prisma.ts'

const BASE = (process.env.PREVIEW_URL || '').replace(/\/+$/, '')
const BYPASS = (process.env.VERCEL_BYPASS_SECRET || '').trim()
const marca = Date.now().toString(36)
const SENHA = 'Ind@' + Math.random().toString(36).slice(2, 10)
let falhas = 0
const checar = (n, ok, d = '') => { if (!ok) falhas++; console.log(`  ${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`) }
const url = (p) => `${BASE}${p}${BYPASS ? (p.includes('?') ? '&' : '?') + 'x-vercel-protection-bypass=' + BYPASS : ''}`
function jar() { const c = new Map(); return {
  guardar(r) { for (const [k, v] of r.headers) { if (k.toLowerCase() !== 'set-cookie') continue
    for (const p of v.split(/,(?=[^;]+=)/)) { const [n, val] = p.split(';')[0].split('='); if (n && val !== undefined) c.set(n.trim(), val.trim()) } } },
  header() { return [...c].map(([k, v]) => `${k}=${v}`).join('; ') }, tem(s) { return [...c.keys()].some(k => k.includes(s)) } } }
async function logar(j, email) {
  const r1 = await fetch(url('/api/auth/csrf'), { headers: { cookie: j.header() } }); j.guardar(r1)
  const { csrfToken } = await r1.json()
  const r2 = await fetch(url('/api/auth/callback/credentials'), { method: 'POST', headers: { cookie: j.header(), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, senha: SENHA, csrfToken, callbackUrl: `${BASE}/`, json: 'true' }).toString(), redirect: 'manual' })
  j.guardar(r2); return j.tem('session-token')
}

const pid = `t04w_${marca}`, cupom = `T04W${marca.toUpperCase()}`
let wsId
async function main() {
  console.log('\n=== SMOKE wiring Ticket 04 (preview) ===\n')
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
  console.log(`Banco: ${host}\nPreview: ${BASE}\n`)
  if (host.includes('ep-lively-firefly')) { console.error('❌ PRODUÇÃO'); process.exit(1) }
  if (!BASE) { console.error('❌ falta PREVIEW_URL'); process.exit(1) }

  // Parceira aprovada com e-mail (destino da notificação)
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Parceiro" ("id","tipo","nome","email","status","ativo","cupom","linkSlug","comissaoPercMensal","comissaoPercAnual","comissaoRecorrente","createdAt")
     VALUES ($1,'influencer','Parceira Wiring',$2,'aprovada',true,$3,$3,30,40,true,NOW())`,
    pid, `pw.${marca}@teste-soa.local`, cupom)
  try {
    // Indicada entra pelo cupom → Lead atribuído
    const email = `indw.${marca}@teste-soa.local`
    const rReg = await fetch(url('/api/auth/register'), { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nome: 'Joana Segredo Wiring', email, senha: SENHA, nomeNegocio: `Ateliê ${marca}`, segmento: 'croche_trico', cupom }) })
    const bReg = await rReg.json().catch(() => ({})); wsId = bReg.workspaceId
    checar('indicada registrada com cupom', rReg.status === 200 && !!wsId)

    // Pix → entra em TRIAL → hook dispara a notificação
    const j = jar(); checar('login da indicada', await logar(j, email))
    const rp = await fetch(url('/api/assinatura/pix'), { method: 'POST', headers: { cookie: j.header(), 'content-type': 'application/json' }, body: JSON.stringify({ plano: 'mensal', cpf: '24971563792' }) })
    const bp = await rp.json().catch(() => ({}))
    checar('Pix gerado (entrou em TRIAL)', rp.status === 200, `status=${rp.status} ${JSON.stringify(bp).slice(0, 160)}`)
    await new Promise(r => setTimeout(r, 1500)) // hook é awaited, mas dá folga

    const [av] = await prisma.$queryRawUnsafe(`SELECT "enviadoEm" FROM "AssinaturaAviso" WHERE "workspaceId"=$1 AND "tipo"='PARCEIRA_SEGUIDORA_TRIAL'`, wsId)
    checar('notificação à parceira registrada + enviada (Resend)', !!av && !!av.enviadoEm)

    // Idempotência: gerar Pix de novo não duplica a notificação
    await fetch(url('/api/assinatura/pix'), { method: 'POST', headers: { cookie: j.header(), 'content-type': 'application/json' }, body: JSON.stringify({ plano: 'mensal', cpf: '24971563792' }) })
    await new Promise(r => setTimeout(r, 800))
    const [{ n }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int n FROM "AssinaturaAviso" WHERE "workspaceId"=$1 AND "tipo"='PARCEIRA_SEGUIDORA_TRIAL'`, wsId)
    checar('idempotente: 1 notificação só', n === 1, `n=${n}`)
  } finally {
    console.log('\n[limpeza dev]')
    if (wsId) for (const t of ['ParceiroComissao', 'AsaasCobranca', 'AsaasAssinatura', 'AsaasCliente', 'AssinaturaAviso', 'Lead', 'WorkspaceTheme', 'User'])
      await prisma.$executeRawUnsafe(`DELETE FROM "${t}" WHERE "workspaceId"=$1`, wsId).catch(() => {})
    if (wsId) await prisma.$executeRawUnsafe(`DELETE FROM "Workspace" WHERE "id"=$1`, wsId).catch(() => {})
    await prisma.$executeRawUnsafe(`DELETE FROM "Lead" WHERE "parceiroId"=$1`, pid).catch(() => {})
    await prisma.$executeRawUnsafe(`DELETE FROM "Parceiro" WHERE "id"=$1`, pid).catch(() => {})
    console.log('  🧹 limpo')
  }
  console.log(`\n${falhas === 0 ? '✅ WIRING OK' : `❌ ${falhas} falha(s)`}\n`)
  process.exit(falhas === 0 ? 0 : 1)
}
main().catch(e => { console.error('❌', e.message, e.stack); process.exit(1) })
