// PROVA — fluxo de onboarding leve (candidatura só contato → completar senha/código
// → aprovação gateada). Determinística: stub de fetch p/ Resend, e decode real do
// token de sessão (mesma função que o getServerSession usa).
//
//   PARCEIRAS_ATIVO=on node --experimental-strip-types --import ./scripts/_loader-alias.mjs \
//     --env-file=.env --env-file=.env.local scripts/provar-parceiras-onboarding.mjs
import { prisma } from '../lib/prisma.ts'
import { criarCandidatura, definirSenhaParceira, definirCodigoParceira, aprovarParceira, recusarParceira } from '../lib/parceiras/candidatura.ts'
import { cookieSessaoOnboarding } from '../lib/parceiras/onboarding.ts'
import { decode } from 'next-auth/jwt'
import bcrypt from 'bcryptjs'

const marca = Date.now().toString(36)
let falhas = 0
const checar = (n, ok, d = '') => { if (!ok) falhas++; console.log(`  ${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`) }

const realFetch = global.fetch
const enviados = []
global.fetch = async (u, o) => { if (String(u).includes('api.resend.com')) { enviados.push(JSON.parse(o.body)); return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' } } return realFetch(u, o) }

const ids = []
const parc = async (id) => (await prisma.$queryRawUnsafe(`SELECT "nome","email","whatsapp","instagram","status","ativo","senhaCripto","cupom","linkSlug" FROM "Parceiro" WHERE "id"=$1`, id))[0]

async function main() {
  console.log('\n=== PROVA — onboarding leve da parceira ===\n')
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
  console.log(`Banco: ${host}\n`)
  if (host.includes('ep-lively-firefly')) { console.error('❌ PRODUÇÃO'); process.exit(1) }
  if (!process.env.NEXTAUTH_SECRET) { console.error('❌ falta NEXTAUTH_SECRET'); process.exit(1) }

  try {
    // [1] Candidatura LEVE
    console.log('[1] Candidatura leve (só contato)')
    const email = `onb.${marca}@teste-soa.local`
    const c = await criarCandidatura({ nome: 'Maria Silva Souza', whatsapp: '(11) 98888-7777', email, instagram: '@maria.atelie' })
    checar('criou e retornou parceiroId', c.ok && !!c.parceiroId); ids.push(c.parceiroId)
    const p1 = await parc(c.parceiroId)
    checar('nasce pendente + inativa, SEM senha/código, com contato', p1.status === 'pendente' && p1.ativo === false && !p1.senhaCripto && !p1.cupom && p1.whatsapp === '(11) 98888-7777' && p1.instagram === 'maria.atelie')
    checar('e-mail duplicado é rejeitado', !(await criarCandidatura({ nome: 'X', whatsapp: '11999999999', email, instagram: 'x' })).ok)
    checar('campos faltando → erro', !(await criarCandidatura({ nome: 'X', whatsapp: '', email: `a.${marca}@t.local`, instagram: 'x' })).ok)

    // [2] Guarda de aprovação ANTES de completar
    console.log('\n[2] Master não aprova cadastro incompleto')
    const antesEmails = enviados.length
    const apr0 = await aprovarParceira(c.parceiroId, { aprovadoPor: 'master' })
    checar('aprovar sem senha/código → erro "não completou"', !apr0.ok && /não completou/.test(apr0.erro || ''))
    checar('nenhum e-mail enviado', enviados.length === antesEmails)

    // [3] Completar senha
    console.log('\n[3] Completar senha')
    checar('senha curta rejeitada', !(await definirSenhaParceira(c.parceiroId, '123')).ok)
    checar('senha válida salva', (await definirSenhaParceira(c.parceiroId, 'segredo123')).ok)
    const p2 = await parc(c.parceiroId)
    checar('senhaCripto é bcrypt e confere', /^\$2[aby]\$/.test(p2.senhaCripto || '') && await bcrypt.compare('segredo123', p2.senhaCripto))

    // [4] Completar código (único)
    console.log('\n[4] Completar código (único)')
    checar('código curto rejeitado', !(await definirCodigoParceira(c.parceiroId, 'ab')).ok)
    const codigo = `MARIA${marca.toUpperCase()}`
    checar('código válido salvo (cupom=linkSlug)', (await definirCodigoParceira(c.parceiroId, codigo)).ok)
    const p3 = await parc(c.parceiroId)
    checar('cupom e linkSlug iguais ao código', p3.cupom === codigo && p3.linkSlug === codigo)
    // duplicado
    const outro = await criarCandidatura({ nome: 'Outra', whatsapp: '11988887777', email: `onb2.${marca}@teste-soa.local`, instagram: 'outra' }); ids.push(outro.parceiroId)
    checar('código já usado por outra → rejeitado', !(await definirCodigoParceira(outro.parceiroId, codigo)).ok)

    // [5] Aprovação agora funciona + e-mail
    console.log('\n[5] Aprovação após completo')
    const apr = await aprovarParceira(c.parceiroId, { aprovadoPor: 'master' })
    checar('aprovar ok', apr.ok)
    const p4 = await parc(c.parceiroId)
    checar('status aprovada + ativa', p4.status === 'aprovada' && p4.ativo === true)
    const email5 = [...enviados].reverse().find(e => (e.to || []).includes(email))
    checar('e-mail de boas-vindas enviado com link do código', !!email5 && /Bem-vinda ao Programa de Parceiras/.test(email5.subject) && email5.html.includes(codigo))

    // [6] Token de sessão de onboarding é válido e escopado
    console.log('\n[6] Sessão de onboarding (token válido, escopo parceira)')
    const ck = await cookieSessaoOnboarding({ parceiroId: c.parceiroId, nome: 'Maria', email })
    checar('cookie httpOnly + path=/', ck.options.httpOnly === true && ck.options.path === '/')
    const tok = await decode({ token: ck.value, secret: process.env.NEXTAUTH_SECRET })
    checar('token decodifica com role=parceira + parceiroId, sem workspaceId', tok?.role === 'parceira' && tok?.parceiroId === c.parceiroId && !tok?.workspaceId, JSON.stringify({ role: tok?.role, ws: tok?.workspaceId }))

    // [7] Recusa envia e-mail
    console.log('\n[7] Recusa')
    checar('recusar ok', (await recusarParceira(outro.parceiroId, 'master')).ok)
    const p6 = await parc(outro.parceiroId)
    checar('status recusada + inativa', p6.status === 'recusada' && p6.ativo === false)

  } finally {
    console.log('\n[limpeza]')
    for (const id of ids.filter(Boolean)) await prisma.$executeRawUnsafe(`DELETE FROM "Parceiro" WHERE "id"=$1`, id).catch(() => {})
    global.fetch = realFetch
    console.log('  🧹 limpo')
  }
  console.log(`\n${falhas === 0 ? '✅ ONBOARDING PASSOU' : `❌ ${falhas} falha(s)`}\n`)
  process.exit(falhas === 0 ? 0 : 1)
}
main().catch(e => { console.error('\n❌ Erro:', e.message, e.stack, '\n'); process.exit(1) })
