// ─────────────────────────────────────────────────────────────────────────────
// PROVA HTTP e2e — TICKET 03 (D+E+F) no Preview:
//   D  papel 'parceira' + guarda de rotas por papel (middleware)
//   E  auto-cadastro + aprovação/recusa no Master
//   F  painel da parceira (funil + timeline + ganhos + material) com TRAVA LGPD
//
//   PREVIEW_URL=https://vps-gestao-....vercel.app \
//   node --experimental-strip-types --import ./scripts/_loader-alias.mjs \
//     --env-file=.env --env-file=.env.local scripts/provar-parceiras-auth.mjs
// Requer no Preview: PARCEIRAS_ATIVO=on, ASSINATURA_NOVO_CADASTRO=on.
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from '../lib/prisma.ts'

const BASE = (process.env.PREVIEW_URL || '').replace(/\/+$/, '')
const BYPASS = (process.env.VERCEL_BYPASS_SECRET || '').trim()
const MASTER = (process.env.MASTER_SECRET_TOKEN || '').trim()
const WALLET = (process.env.ASAAS_WALLET_TESTE || '').trim() || '11111111-1111-1111-1111-111111111111'
const marca = Date.now().toString(36)
const SENHA = 'Parc@' + Math.random().toString(36).slice(2, 10)
let falhas = 0
const checar = (n, ok, d = '') => { if (!ok) falhas++; console.log(`  ${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`) }
const url = (p) => `${BASE}${p}${BYPASS ? (p.includes('?') ? '&' : '?') + 'x-vercel-protection-bypass=' + BYPASS : ''}`
const jget = async (p, cookie, redirect = 'follow') => fetch(url(p), { headers: cookie ? { cookie } : {}, redirect })

function jar() { const c = new Map(); return {
  guardar(r) { for (const [k, v] of r.headers) { if (k.toLowerCase() !== 'set-cookie') continue
    for (const p of v.split(/,(?=[^;]+=)/)) { const [n, val] = p.split(';')[0].split('='); if (n && val !== undefined) c.set(n.trim(), val.trim()) } } },
  header() { return [...c].map(([k, v]) => `${k}=${v}`).join('; ') }, tem(s) { return [...c.keys()].some(k => k.includes(s)) } } }
async function logar(email, senha) {
  const j = jar()
  const r1 = await fetch(url('/api/auth/csrf'), { headers: { cookie: j.header() } }); j.guardar(r1)
  const { csrfToken } = await r1.json()
  const r2 = await fetch(url('/api/auth/callback/credentials'), { method: 'POST', headers: { cookie: j.header(), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, senha, csrfToken, callbackUrl: `${BASE}/`, json: 'true' }).toString(), redirect: 'manual' })
  j.guardar(r2)
  return { ok: j.tem('session-token'), header: j.header() }
}
const candidatar = (nome, email, codigo) => fetch(url('/api/parceira/candidatar'), {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ nome, email, senha: SENHA, walletId: WALLET, codigo }) })
const master = (id, acao, codigo) => fetch(url(`/api/master/parceiros/${id}`), {
  method: 'POST', headers: { 'content-type': 'application/json', cookie: `master_token=${MASTER}` },
  body: JSON.stringify({ acao, codigo }) })
const registrar = async (nome, email, cupom) => {
  const r = await fetch(url('/api/auth/register'), { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nome, email, senha: SENHA, nomeNegocio: `Ateliê ${marca}`, segmento: 'croche_trico', cupom }) })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}
const parceiroPorEmail = async (email) => (await prisma.$queryRawUnsafe(
  `SELECT "id","status","ativo","cupom","linkSlug","senhaCripto" FROM "Parceiro" WHERE lower("email")=lower($1) LIMIT 1`, email))[0]

const semeados = { emails: [], ws: [] }

async function main() {
  console.log('\n=== PROVA HTTP e2e — TICKET 03 D+E+F (Preview) ===\n')
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
  console.log(`Banco: ${host}\nPreview: ${BASE}\n`)
  if (host.includes('ep-lively-firefly')) { console.error('❌ APONTANDO PARA PRODUÇÃO — abortado'); process.exit(1) }
  if (!BASE || !MASTER) { console.error('❌ falta PREVIEW_URL / MASTER_SECRET_TOKEN'); process.exit(1) }

  const emailA = `pA.${marca}@teste-soa.local`, codeA = `AAA${marca.toUpperCase()}`
  const emailB = `pB.${marca}@teste-soa.local`, codeB = `BBB${marca.toUpperCase()}`, codeBadj = `BBZ${marca.toUpperCase()}`
  const emailC = `pC.${marca}@teste-soa.local`, codeC = `CCC${marca.toUpperCase()}`
  semeados.emails.push(emailA, emailB, emailC)

  try {
    // ── [E] AUTO-CADASTRO ────────────────────────────────────────────────────
    console.log('[E] Auto-cadastro + validação de código')
    const g1 = await (await jget(`/api/parceira/candidatar?codigo=${codeA}`)).json()
    checar('código novo → valido & disponivel', g1.valido === true && g1.disponivel === true, JSON.stringify(g1))
    const gInv = await (await jget(`/api/parceira/candidatar?codigo=ab`)).json()
    checar('código curto → invalido', gInv.valido === false)

    checar('candidatura A criada', (await candidatar('Parceira A', emailA, codeA)).status === 200)
    checar('candidatura B criada', (await candidatar('Parceira B', emailB, codeB)).status === 200)
    checar('candidatura C criada', (await candidatar('Parceira C', emailC, codeC)).status === 200)
    const pA0 = await parceiroPorEmail(emailA)
    checar('A nasce pendente + inativa + senha CIFRADA (bcrypt)', pA0?.status === 'pendente' && pA0?.ativo === false && /^\$2[aby]\$/.test(pA0?.senhaCripto || ''), pA0?.status)

    const gDup = await (await jget(`/api/parceira/candidatar?codigo=${codeA}`)).json()
    checar('código já usado → indisponível', gDup.valido === true && gDup.disponivel === false)
    checar('POST com código duplicado é rejeitado (400)', (await candidatar('Dup', `dup.${marca}@teste-soa.local`, codeA)).status === 400)

    // ── [D] pendente NÃO loga ─────────────────────────────────────────────────
    console.log('\n[D] Guarda de acesso por papel')
    checar('candidata PENDENTE não consegue logar', !(await logar(emailB, SENHA)).ok)

    // ── [E] Master aprova / ajusta / recusa ───────────────────────────────────
    checar('Master aprova A (sem ajuste)', (await master(pA0.id, 'aprovar')).status === 200)
    const pB0 = await parceiroPorEmail(emailB)
    checar('Master aprova B AJUSTANDO o código', (await master(pB0.id, 'aprovar', codeBadj)).status === 200)
    const pC0 = await parceiroPorEmail(emailC)
    checar('Master recusa C', (await master(pC0.id, 'recusar')).status === 200)
    const [pA, pB, pC] = await Promise.all([parceiroPorEmail(emailA), parceiroPorEmail(emailB), parceiroPorEmail(emailC)])
    checar('A: aprovada + ativa', pA?.status === 'aprovada' && pA?.ativo === true)
    checar('B: cupom E linkSlug ajustados p/ BBZ', pB?.cupom === codeBadj && pB?.linkSlug === codeBadj)
    checar('C: recusada + inativa', pC?.status === 'recusada' && pC?.ativo === false)
    checar('Master sem token → 401', (await fetch(url(`/api/master/parceiros/${pA.id}`), { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"acao":"recusar"}' })).status === 401)

    // ── [D] papel parceira loga e é roteado ───────────────────────────────────
    const loginA = await logar(emailA, SENHA)
    checar('parceira APROVADA loga', loginA.ok)
    const sess = await (await jget('/api/auth/session', loginA.header)).json()
    checar('sessão tem role=parceira + parceiroId + workspaceId null', sess?.user?.role === 'parceira' && sess?.user?.parceiroId === pA.id && (sess?.user?.workspaceId ?? null) === null, JSON.stringify(sess?.user))
    checar('candidata RECUSADA não loga', !(await logar(emailC, SENHA)).ok)

    const rParcAnon = await jget('/parceira', '', 'manual')
    checar('/parceira sem sessão → redireciona /login', rParcAnon.status >= 300 && rParcAnon.status < 400 && (rParcAnon.headers.get('location') || '').includes('/login'), `${rParcAnon.status} ${rParcAnon.headers.get('location')}`)
    const rParcParc = await jget('/parceira', loginA.header, 'manual')
    checar('parceira acessa /parceira (não redireciona p/ login)', !(rParcParc.status >= 300 && rParcParc.status < 400 && (rParcParc.headers.get('location') || '').includes('/login')), `${rParcParc.status} ${rParcParc.headers.get('location')}`)
    const rParcDash = await jget('/dashboard', loginA.header, 'manual')
    checar('parceira em rota de artesã (/dashboard) → redireciona /parceira', (rParcDash.headers.get('location') || '').includes('/parceira'), `${rParcDash.status} ${rParcDash.headers.get('location')}`)

    // artesã comum barrada em /parceira
    const emailArt = `art.${marca}@teste-soa.local`
    const reg = await registrar('Artesã Comum', emailArt, undefined)
    checar('artesã registrada', reg.status === 200 && !!reg.body.workspaceId, `status=${reg.status}`)
    semeados.ws.push(reg.body.workspaceId)
    const loginArt = await logar(emailArt, SENHA)
    const rArtParc = await jget('/parceira', loginArt.header, 'manual')
    checar('artesã em /parceira → redireciona /modulos', (rArtParc.headers.get('location') || '').includes('/modulos'), `${rArtParc.status} ${rArtParc.headers.get('location')}`)

    // ── [F] PAINEL + TRAVA LGPD ───────────────────────────────────────────────
    console.log('\n[F] Painel da parceira + trava LGPD')
    // indicada atribuída à A por cupom (nome com sobrenome "secreto")
    const indic = await registrar('Fulana SEGREDOSOBRENOME Silva', `ind.${marca}@teste-soa.local`, pA.cupom)
    checar('indicada registrada com cupom de A', indic.status === 200 && !!indic.body.workspaceId)
    semeados.ws.push(indic.body.workspaceId)

    // clique anônimo antes/depois
    const dashAntes = await (await jget('/api/parceira/dashboard', loginA.header)).json()
    await jget(`/r/${pA.linkSlug}`, '', 'manual')
    await new Promise(r => setTimeout(r, 600)) // insert best-effort é async no redirect
    const dash = await (await jget('/api/parceira/dashboard', loginA.header)).json()

    checar('dashboard retorna funil+ganhos+material+timeline', !!dash.funil && !!dash.ganhos && !!dash.material && Array.isArray(dash.timeline))
    checar('funil.cadastros ≥ 1 (indicada contabilizada)', dash.funil?.cadastros >= 1, `cadastros=${dash.funil?.cadastros}`)
    checar('clique contabilizado (funil.cliques subiu)', (dash.funil?.cliques ?? 0) > (dashAntes.funil?.cliques ?? 0), `${dashAntes.funil?.cliques} → ${dash.funil?.cliques}`)
    checar('material traz linkSlug + cupom copiáveis', dash.material?.linkSlug === pA.linkSlug && dash.material?.cupom === pA.cupom)
    checar('timeline mostra SÓ 1º nome (Fulana, sem sobrenome)', dash.timeline.some(e => e.nome === 'Fulana') && !dash.timeline.some(e => /SEGREDOSOBRENOME|Silva/.test(e.nome || '')))
    const bruto = JSON.stringify(dash)
    checar('🔒 LGPD: resposta NÃO contém e-mail/@ nem sobrenome da indicada', !bruto.includes('@') && !bruto.includes('SEGREDOSOBRENOME') && !/telefone|cpf|cpfCnpj/i.test(bruto))

    // escopo: dashboard de B não enxerga indicada de A
    const loginB = await logar(emailB, SENHA)
    const dashB = await (await jget('/api/parceira/dashboard', loginB.header)).json()
    checar('escopo: B não vê cadastros de A (funil.cadastros=0)', dashB.funil?.cadastros === 0, `B.cadastros=${dashB.funil?.cadastros}`)

    // dashboard exige papel parceira
    checar('dashboard como artesã → 401', (await jget('/api/parceira/dashboard', loginArt.header)).status === 401)
    checar('dashboard sem sessão → 401', (await jget('/api/parceira/dashboard', '')).status === 401)

  } finally {
    console.log('\n[limpeza dev]')
    for (const ws of semeados.ws.filter(Boolean)) {
      for (const t of ['ParceiroComissao', 'AsaasCobranca', 'AsaasAssinatura', 'AsaasCliente', 'AssinaturaAviso', 'Lead', 'WorkspaceTheme', 'User'])
        await prisma.$executeRawUnsafe(`DELETE FROM "${t}" WHERE "workspaceId"=$1`, ws).catch(() => {})
      await prisma.$executeRawUnsafe(`DELETE FROM "Workspace" WHERE "id"=$1`, ws).catch(() => {})
    }
    for (const email of semeados.emails) {
      const p = await parceiroPorEmail(email).catch(() => null)
      if (p) {
        await prisma.$executeRawUnsafe(`DELETE FROM "ParceiroClique" WHERE "parceiroId"=$1`, p.id).catch(() => {})
        await prisma.$executeRawUnsafe(`DELETE FROM "ParceiroComissao" WHERE "parceiroId"=$1`, p.id).catch(() => {})
        await prisma.$executeRawUnsafe(`DELETE FROM "Lead" WHERE "parceiroId"=$1`, p.id).catch(() => {})
        await prisma.$executeRawUnsafe(`DELETE FROM "Parceiro" WHERE "id"=$1`, p.id).catch(() => {})
      }
    }
    console.log('  🧹 limpo')
  }
  console.log(`\n${falhas === 0 ? '✅ TICKET 03 (D+E+F) HTTP e2e PASSOU' : `❌ ${falhas} falha(s)`}\n`)
  process.exit(falhas === 0 ? 0 : 1)
}
main().catch(e => { console.error('\n❌ Erro:', e.message, e.stack, '\n'); process.exit(1) })
