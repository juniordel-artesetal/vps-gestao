// PROVA — reengajamento. Determinística: seed real no dev, stub de fetch p/ Resend.
// Confere: fonte única (alertas == Sofia), dry-run não envia, "em dia" não recebe,
// inativa/pendente recebe, cooldown + opt-out honrados, LGPD (sem CPF), deep-links.
//
//   node --experimental-strip-types --import ./scripts/_loader-alias.mjs \
//     --env-file=.env --env-file=.env.local scripts/provar-reengajamento.mjs
import { prisma } from '../lib/prisma.ts'
import { listarCandidatas, montarEmail, executarReengajamento, tokenOptOut, tokenOptOutValido, emailReengajamentoRecente } from '../lib/reengajamento.ts'
import { calcularAlertas } from '../lib/sofia/alertas.ts'

const marca = Date.now().toString(36)
let falhas = 0
const checar = (n, ok, d = '') => { if (!ok) falhas++; console.log(`  ${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`) }

const realFetch = global.fetch
let enviados = []
global.fetch = async (u, o) => { if (String(u).includes('api.resend.com')) { enviados.push(JSON.parse(o.body)); return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' } } return realFetch(u, o) }

const WSs = []
async function seedWs(tag, { ultimoAcesso, atividade, atrasado, cpf }) {
  const ws = `re_${tag}_${marca}`; WSs.push(ws)
  const uid = `u_${tag}_${marca}`
  await prisma.$executeRawUnsafe(`INSERT INTO "Workspace" ("id","nome","slug","ativo","createdAt","updatedAt") VALUES ($1,$2,$3,true,NOW()-INTERVAL '30 days',NOW())`, ws, `WS ${tag}`, `ws-${tag}-${marca}`)
  await prisma.$executeRawUnsafe(`INSERT INTO "User" ("id","workspaceId","nome","email","senha","role","ativo","primeiroLogin","ultimoAcesso","createdAt") VALUES ($1,$2,'Fulana Teste',$3,'x','ADMIN',true,false,${ultimoAcesso},NOW()-INTERVAL '30 days')`, uid, ws, `re.${tag}.${marca}@teste-soa.local`)
  if (cpf) await prisma.$executeRawUnsafe(`INSERT INTO "Cliente" ("id","workspaceId","nome","documento","ativo","createdAt","updatedAt") VALUES ($1,$2,'Ana',$3,true,NOW(),NOW())`, `c_${tag}_${marca}`, ws, cpf)
  if (atrasado) await prisma.$executeRawUnsafe(`INSERT INTO "Order" ("id","workspaceId","numero","destinatario","produto","status","valor","dataEnvio","createdAt","updatedAt") VALUES ($1,$2,'1','Ana','Colar','EM_PRODUCAO',10,CURRENT_DATE-3,NOW()-INTERVAL '10 days',NOW())`, `o_${tag}_${marca}`, ws)
  if (atividade === 'hoje') await prisma.$executeRawUnsafe(`INSERT INTO "Order" ("id","workspaceId","numero","destinatario","produto","status","valor","dataEnvio","createdAt","updatedAt") VALUES ($1,$2,'2','B','Brinco','ENVIADO',10,CURRENT_DATE+5,NOW(),NOW())`, `o2_${tag}_${marca}`, ws)
  return { ws, uid, email: `re.${tag}.${marca}@teste-soa.local` }
}

async function main() {
  console.log('\n=== PROVA — Reengajamento ===\n')
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
  if (host.includes('ep-lively-firefly')) { console.error('❌ PRODUÇÃO'); process.exit(1) }

  const A = await seedWs('A', { ultimoAcesso: 'NOW()', atividade: 'hoje', atrasado: true, cpf: '52998224725' }) // pendência
  const B = await seedWs('B', { ultimoAcesso: 'NOW()', atividade: 'hoje' })                                     // em dia
  const C = await seedWs('C', { ultimoAcesso: `NOW()-INTERVAL '6 days'` })                                       // sumida
  const D = await seedWs('D', { ultimoAcesso: 'NOW()', atrasado: true })                                         // opt-out
  const E = await seedWs('E', { ultimoAcesso: 'NOW()', atrasado: true })                                         // cooldown
  await prisma.$executeRawUnsafe(`INSERT INTO "ReengajamentoOptOut" ("userId","workspaceId","criadoEm") VALUES ($1,$2,NOW())`, D.uid, D.ws)
  await prisma.$executeRawUnsafe(`INSERT INTO "ReengajamentoEnvio" ("id","workspaceId","userId","enviadoEm","motivo") VALUES ($1,$2,$3,NOW()-INTERVAL '1 day','alertas')`, `env_${marca}`, E.ws, E.uid)

  try {
    const cands = await listarCandidatas()
    const byWs = Object.fromEntries(cands.map(c => [c.workspaceId, c]))
    console.log('[quem receberia]')
    checar('A (pendência) é candidata, motivo=alertas', byWs[A.ws]?.motivo === 'alertas')
    checar('B (em dia e ativa) NÃO recebe', !byWs[B.ws])
    checar('C (sumida) é candidata (inativa/estagnada)', !!byWs[C.ws] && byWs[C.ws].soInatividade)
    checar('D (opt-out) NÃO recebe', !byWs[D.ws])
    checar('E (cooldown) NÃO recebe', !byWs[E.ws])

    console.log('\n[fonte única + conteúdo]')
    const alDireto = await calcularAlertas(A.ws)
    checar('alertas da candidata == calcularAlertas (mesmo motor)', JSON.stringify(byWs[A.ws].alertas) === JSON.stringify(alDireto))
    const em = montarEmail(byWs[A.ws])
    checar('e-mail A: alerta de atraso + botão com deep-link absoluto', /pedido atrasado/i.test(em.html) && em.html.includes('https://www.usesoa.com.br/dashboard/pedidos?atrasados=1'))
    checar('e-mail A: link de opt-out com token', em.html.includes(`/api/reengajamento/optout?u=${A.uid}&t=${tokenOptOut(A.uid)}`))
    checar('🔒 LGPD: e-mail A sem CPF', !em.html.includes('52998224725'))
    const emC = montarEmail(byWs[C.ws])
    checar('e-mail C (sumida): mensagem leve “senti sua falta”', /Senti sua falta/.test(emC.assunto) && !/atrasado/i.test(emC.html))

    console.log('\n[token opt-out]')
    checar('token válido aceito', tokenOptOutValido(A.uid, tokenOptOut(A.uid)))
    checar('token errado rejeitado', !tokenOptOutValido(A.uid, 'xxxxxxxxxxxxxxxxxxxxxxxx'))

    console.log('\n[dry-run vs envio real]')
    enviados = []
    const dry = await executarReengajamento({ dryRun: true })
    const [{ n: logDepoisDry }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int n FROM "ReengajamentoEnvio" WHERE "workspaceId" = ANY($1)`, [A.ws, C.ws])
    checar('dry-run lista mas NÃO envia nem grava log', dry.dryRun && dry.enviados === 0 && enviados.length === 0 && logDepoisDry === 0)
    checar('dry-run inclui A e C nos itens', dry.itens.some(i => i.email === A.email) && dry.itens.some(i => i.email === C.email))

    enviados = []
    const real = await executarReengajamento({ dryRun: false })
    checar('envio real dispara Resend + grava log', real.enviados >= 2 && enviados.length >= 2)
    checar('e-mail chegou a A e C', enviados.some(e => (e.to || []).includes(A.email)) && enviados.some(e => (e.to || []).includes(C.email)))
    checar('Sofia reconhece e-mail recente (A)', await emailReengajamentoRecente(A.uid))

    console.log('\n[cooldown após envio]')
    enviados = []
    const real2 = await executarReengajamento({ dryRun: false })
    checar('2ª rodada no mesmo dia: A e C agora em cooldown (não reenvia)', !real2.itens.some(i => i.email === A.email) && !real2.itens.some(i => i.email === C.email) && enviados.length === 0)

  } finally {
    console.log('\n[limpeza]')
    for (const ws of WSs) {
      await prisma.$executeRawUnsafe(`DELETE FROM "ReengajamentoEnvio" WHERE "workspaceId"=$1`, ws).catch(() => {})
      await prisma.$executeRawUnsafe(`DELETE FROM "ReengajamentoOptOut" WHERE "workspaceId"=$1`, ws).catch(() => {})
      for (const t of ['Order', 'Cliente', 'User', 'Workspace']) await prisma.$executeRawUnsafe(`DELETE FROM "${t}" WHERE "${t === 'Workspace' ? 'id' : 'workspaceId'}"=$1`, ws).catch(() => {})
    }
    global.fetch = realFetch
    console.log('  🧹 limpo')
  }
  console.log(`\n${falhas === 0 ? '✅ REENGAJAMENTO PASSOU' : `❌ ${falhas} falha(s)`}\n`)
  process.exit(falhas === 0 ? 0 : 1)
}
main().catch(e => { console.error('❌', e.message, e.stack); process.exit(1) })
