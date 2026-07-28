import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const B = 'https://www.usesoa.com.br'
const marca = Date.now().toString(36)
const SENHA = 'Pc@' + marca
let falhas = 0
const ok = (n, c, d = '') => { if (!c) falhas++; console.log(`  ${c ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`) }
function jar() { const c = new Map(); return {
  guardar(r) { for (const [k, v] of r.headers) { if (k.toLowerCase() !== 'set-cookie') continue
    for (const p of v.split(/,(?=[^;]+=)/)) { const [n, val] = p.split(';')[0].split('='); if (n && val !== undefined) c.set(n.trim(), val.trim()) } } },
  header() { return [...c].map(([k, v]) => `${k}=${v}`).join('; ') }, tem(s) { return [...c.keys()].some(k => k.includes(s)) } } }
async function logar(j, email) {
  const r1 = await fetch(`${B}/api/auth/csrf`, { headers: { cookie: j.header() } }); j.guardar(r1)
  const { csrfToken } = await r1.json()
  const r2 = await fetch(`${B}/api/auth/callback/credentials`, { method: 'POST', headers: { cookie: j.header(), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, senha: SENHA, csrfToken, callbackUrl: `${B}/`, json: 'true' }).toString(), redirect: 'manual' })
  j.guardar(r2); return j.tem('session-token')
}
async function main() {
  console.log('\n=== SMOKE preço /migrar (prod) ===\n')
  const url = (process.env.DIRECT_URL || '').replace(/-pooler/, '')
  if (!url.includes('ep-lively-firefly')) { console.error('❌ sem DIRECT_URL prod'); process.exit(1) }
  const prisma = new PrismaClient({ datasources: { db: { url } } })
  const wl = `wl.${marca}@teste-soa.local`, nwl = `nwl.${marca}@teste-soa.local`
  const WS1 = `pc1_${marca}`, WS2 = `pc2_${marca}`
  try {
    const senha = await bcrypt.hash(SENHA, 10)
    for (const [ws, email] of [[WS1, wl], [WS2, nwl]]) {
      await prisma.$executeRawUnsafe(`INSERT INTO "Workspace" ("id","nome","slug","ativo","createdAt","updatedAt") VALUES ($1,$2,$3,true,NOW(),NOW())`, ws, `WS ${ws}`, `ws-${ws}`)
      await prisma.$executeRawUnsafe(`INSERT INTO "User" ("id","workspaceId","nome","email","senha","role","ativo","primeiroLogin","createdAt") VALUES ($1,$2,'Artesã',$3,$4,'ADMIN',true,false,NOW())`, `u_${ws}`, ws, email, senha)
    }
    // wl entra na whitelist da campanha; nwl NÃO
    await prisma.$executeRawUnsafe(`INSERT INTO "CampanhaMigracao" ("id","email","primeiroNome","estado","dataInicio","createdAt","updatedAt") VALUES ($1,$2,'Ana','pendente',CURRENT_DATE,NOW(),NOW())`, `cm_${marca}`, wl)

    const j1 = jar(); ok('login whitelist', await logar(j1, wl))
    const p1 = await (await fetch(`${B}/api/campanha/migrar`, { headers: { cookie: j1.header() } })).json()
    ok('🎯 whitelist (um dos 130) → 1º mês R$9,90', p1.temCupom === true && p1.primeiroMes === 9.9 && p1.mensal === 29.9, JSON.stringify(p1))

    const j2 = jar(); ok('login fora da whitelist', await logar(j2, nwl))
    const p2 = await (await fetch(`${B}/api/campanha/migrar`, { headers: { cookie: j2.header() } })).json()
    ok('fora da whitelist → 29,90 (sem desconto)', p2.temCupom === false && p2.primeiroMes === 29.9, JSON.stringify(p2))
  } finally {
    console.log('\n[limpeza]')
    await prisma.$executeRawUnsafe(`DELETE FROM "CampanhaMigracao" WHERE "email"=$1`, wl).catch(() => {})
    for (const ws of [WS1, WS2]) { await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE "workspaceId"=$1`, ws).catch(() => {}); await prisma.$executeRawUnsafe(`DELETE FROM "Workspace" WHERE "id"=$1`, ws).catch(() => {}) }
    await prisma.$disconnect(); console.log('  🧹 removido')
  }
  // reenvia amostras (agora com o link /migrar via env)
  const M = process.env.MASTER_SECRET_TOKEN
  const am = await fetch(`${B}/api/master/campanha`, { method: 'POST', headers: { cookie: 'master_token=' + M, 'content-type': 'application/json' }, body: JSON.stringify({ acao: 'amostras' }) })
  console.log('\namostras (link /migrar) →', am.status, JSON.stringify(await am.json()))
  console.log(`\n${falhas === 0 ? '✅ PREÇO /migrar OK' : `❌ ${falhas} falha(s)`}\n`)
  process.exit(falhas === 0 ? 0 : 1)
}
main().catch(e => { console.error('❌', e.message); process.exit(1) })
