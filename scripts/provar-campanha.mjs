// PROVA — motor de campanha de migração (dry-run). Cadência, seed, régua (tipo/
// expira/optout/idempotência), cupom whitelist, opt-out. ENVIO REAL fica travado
// pela flag+link; aqui forço o cenário de envio só para provar idempotência (stub).
//
//   node --experimental-strip-types --import ./scripts/_loader-alias.mjs \
//     --env-file=.env --env-file=.env.local scripts/provar-campanha.mjs
import { prisma } from '../lib/prisma.ts'
import { decidirCadencia } from '../lib/campanha/cadencia.ts'
import { parseCsvCampanha, semearCampanha } from '../lib/campanha/seed.ts'
import { rodarCampanha } from '../lib/campanha/regua.ts'
import { validarCupomMigracao, marcarCupomUsado } from '../lib/campanha/cupom.ts'
import { tokenOptOut, tokenOptOutValido } from '../lib/campanha/emails.ts'

const marca = Date.now().toString(36)
let falhas = 0
const checar = (n, ok, d = '') => { if (!ok) falhas++; console.log(`  ${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`) }
const em = (t) => `camp.${t}.${marca}@teste-soa.local`

const realFetch = global.fetch
let enviados = []
global.fetch = async (u, o) => { if (String(u).includes('api.resend.com')) { enviados.push(JSON.parse(o.body)); return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' } } return realFetch(u, o) }

const seedRow = (tag, estado, diasAtras) => prisma.$executeRawUnsafe(
  `INSERT INTO "CampanhaMigracao" ("id","email","primeiroNome","estado","dataInicio","createdAt","updatedAt")
   VALUES ($1,$2,$3,$4,CURRENT_DATE - $5::int,NOW(),NOW()) ON CONFLICT ("email") DO NOTHING`,
  `c_${tag}_${marca}`, em(tag), 'Maria', estado, diasAtras)

async function main() {
  console.log('\n=== PROVA — campanha de migração ===\n')
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
  if (host.includes('ep-lively-firefly')) { console.error('❌ PRODUÇÃO'); process.exit(1) }

  try {
    // [cadência] pura
    console.log('[cadência]')
    const d = (di) => decidirCadencia(new Date(Date.now() - (di - 1) * 86400000), new Date())
    checar('D1..D7 diário (D5 envia)', d(5).enviar && d(5).dia === 5)
    checar('D8 envia · D9 não · D10 envia (dia sim/não)', d(8).enviar && !d(9).enviar && d(10).enviar)
    checar('D14 envia · D15 envia · D16 não (semanal)', d(14).enviar && d(15).enviar && !d(16).enviar)
    checar('D22 envia · D29 expira', d(22).enviar && d(29).expira && !d(29).enviar)

    // [seed] CSV
    console.log('\n[seed CSV]')
    const csv = `primeiro_nome,email,status_hotmart\nAna,${em('csvA')},ACTIVE\nBia,${em('csvB')},ACTIVE\nAna2,${em('csvA')},ACTIVE\n,sememail,ACTIVE`
    const linhas = parseCsvCampanha(csv)
    checar('parser dedup + valida e-mail (2 válidos)', linhas.length === 2)
    const s = await semearCampanha(linhas)
    checar('semeou 2 como pendente', s.inseridos === 2)
    const s2 = await semearCampanha(linhas)
    checar('reprocessar não duplica (ignora)', s2.inseridos === 0)

    // [régua dry-run] tipos + expira + optout
    console.log('\n[régua dry-run]')
    await seedRow('fluxo', 'pendente', 0)          // D1 → fluxo
    await seedRow('cancelou', 'cancelou_hotmart', 4) // D5 → falta_assinar
    await seedRow('assinou', 'assinou_asaas', 4)     // D5 → falta_cancelar
    await seedRow('naoenvia', 'pendente', 8)         // D9 → não envia
    await seedRow('expira', 'pendente', 30)          // D31 → expira
    await seedRow('optout', 'optout', 0)             // excluída
    enviados = []
    const r = await rodarCampanha({ dryRun: true, pularValidacao: true })
    const porEmail = Object.fromEntries(r.itens.map(i => [i.email, i.tipo]))
    checar('dry-run não envia (enviados=0)', r.enviados === 0 && enviados.length === 0)
    checar('fluxo (D1) → tipo fluxo', porEmail[em('fluxo')] === 'fluxo')
    checar('cancelou_hotmart → falta_assinar', porEmail[em('cancelou')] === 'falta_assinar')
    checar('assinou_asaas → falta_cancelar', porEmail[em('assinou')] === 'falta_cancelar')
    checar('D9 não recebe', !porEmail[em('naoenvia')])
    checar('optout não recebe', !porEmail[em('optout')])
    const [exp] = await prisma.$queryRawUnsafe(`SELECT "estado" FROM "CampanhaMigracao" WHERE "email"=$1`, em('expira'))
    checar('D31 vira expirada', exp?.estado === 'expirada')

    // [gate] sem flag/link → dryRun forçado
    console.log('\n[gate de envio real]')
    delete process.env.CAMPANHA_MIGRACAO_ATIVO; delete process.env.CAMPANHA_ASAAS_LINK
    const g = await rodarCampanha({ pularValidacao: true })
    checar('sem flag/link → dryRun=true (nunca envia)', g.dryRun === true && g.enviados === 0)

    // [envio real + idempotência] força cenário (stub)
    console.log('\n[envio real forçado + idempotência]')
    process.env.CAMPANHA_MIGRACAO_ATIVO = 'on'; process.env.CAMPANHA_ASAAS_LINK = 'https://www.usesoa.com.br/assinar?cupom=MIGRA20'
    enviados = []
    const rr = await rodarCampanha({ pularValidacao: true })
    checar('com flag+link → envia de verdade (stub)', !rr.dryRun && rr.enviados >= 3 && enviados.length >= 3)
    checar('e-mail traz o link do Asaas + opt-out', enviados[0].html.includes('cupom=MIGRA20') && /optout/.test(enviados[0].html))
    enviados = []
    const rr2 = await rodarCampanha({ pularValidacao: true })
    checar('idempotência: 2ª rodada no mesmo dia não reenvia', rr2.enviados === 0 && enviados.length === 0)
    delete process.env.CAMPANHA_MIGRACAO_ATIVO; delete process.env.CAMPANHA_ASAAS_LINK

    // [cupom] whitelist + uso único
    console.log('\n[cupom whitelist]')
    checar('e-mail da campanha → cupom válido (R$20)', (await validarCupomMigracao(em('fluxo'))).valido === true)
    checar('e-mail de fora → recusado', (await validarCupomMigracao('estranho@x.com')).valido === false)
    await marcarCupomUsado(em('fluxo'))
    checar('uso único: após aplicar → recusado', (await validarCupomMigracao(em('fluxo'))).valido === false)

    // [opt-out token]
    console.log('\n[opt-out token]')
    checar('token válido aceito', tokenOptOutValido(em('fluxo'), tokenOptOut(em('fluxo'))))
    checar('token errado rejeitado', !tokenOptOutValido(em('fluxo'), 'xxxxxxxxxxxxxxxxxxxxxxxx'))

  } finally {
    console.log('\n[limpeza]')
    await prisma.$executeRawUnsafe(`DELETE FROM "CampanhaMigracaoEnvio" WHERE "email" LIKE $1`, `%${marca}%`).catch(() => {})
    await prisma.$executeRawUnsafe(`DELETE FROM "CampanhaMigracao" WHERE "email" LIKE $1`, `%${marca}%`).catch(() => {})
    global.fetch = realFetch
    console.log('  🧹 limpo')
  }
  console.log(`\n${falhas === 0 ? '✅ CAMPANHA PASSOU' : `❌ ${falhas} falha(s)`}\n`)
  process.exit(falhas === 0 ? 0 : 1)
}
main().catch(e => { console.error('❌', e.message, e.stack); process.exit(1) })
