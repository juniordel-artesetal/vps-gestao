// ─────────────────────────────────────────────────────────────────────────────
// PROVA — TICKET 04 (notificações + resumo semanal + copy VERBATIM). Determinística:
// stub de global.fetch captura o que iria pro Resend (sem depender de entrega),
// e prova copy exata + LGPD (só 1º nome) + agregação + idempotência.
//
//   PARCEIRAS_ATIVO=on node --experimental-strip-types --import ./scripts/_loader-alias.mjs \
//     --env-file=.env --env-file=.env.local scripts/provar-parceiras-ticket04.mjs
// (Prisma usa TCP, não fetch — o stub só intercepta Resend.)
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from '../lib/prisma.ts'
import { emailAprovacao, emailRecusa, emailSeguidoraTrial, emailResumoSemanal, emailResumoSemanalSemNovidades } from '../lib/parceiras/emails.ts'
import { competenciaSemana, enviarResumosSemanais } from '../lib/parceiras/resumoSemanal.ts'
import { avisarParceiraSeguidoraTrial } from '../lib/parceiras/notificacoes.ts'

const marca = Date.now().toString(36)
let falhas = 0
const checar = (n, ok, d = '') => { if (!ok) falhas++; console.log(`  ${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`) }
const id = (t) => `t04_${t}_${marca}`

// Stub do fetch: só intercepta o Resend, o resto passa direto.
const realFetch = global.fetch
const enviados = []
global.fetch = async (u, o) => {
  if (String(u).includes('api.resend.com')) { enviados.push(JSON.parse(o.body)); return { ok: true, status: 200, json: async () => ({ id: 'stub' }), text: async () => '{}' } }
  return realFetch(u, o)
}
const ultimoPara = (email) => [...enviados].reverse().find(e => (e.to || []).includes(email))

const seed = { ws: [], parc: [] }
async function semear() {
  // Parceira A (com atividade) + parceira B (sem atividade)
  for (const [tag, cupom] of [['A', `T04A${marca.toUpperCase()}`], ['B', `T04B${marca.toUpperCase()}`]]) {
    const pid = id(`p${tag}`); seed.parc.push(pid)
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Parceiro" ("id","tipo","nome","email","status","ativo","cupom","linkSlug","comissaoPercMensal","comissaoPercAnual","comissaoRecorrente","createdAt")
       VALUES ($1,'influencer',$2,$3,'aprovada',true,$4,$4,30,40,true,NOW())`,
      pid, `Parceira ${tag} Sobrenome`, `p${tag}.${marca}@teste-soa.local`, cupom)
  }
  const [pA] = seed.parc
  // Workspace + admin + Lead da indicada (atribuída a A)
  const ws = id('ws'); seed.ws.push(ws)
  await prisma.$executeRawUnsafe(`INSERT INTO "Workspace" ("id","nome","slug","planoEscolhido","assinaturaStatus","createdAt","updatedAt") VALUES ($1,$2,$3,'mensal','TRIAL',NOW(),NOW())`, ws, `Ateliê ${marca}`, `atelie-${marca}`)
  await prisma.$executeRawUnsafe(`INSERT INTO "User" ("id","workspaceId","nome","email","senha","role","ativo","createdAt") VALUES ($1,$2,$3,$4,'x','ADMIN',true,NOW())`, id('u'), ws, 'Fulana SEGREDOSOBRENOME Silva', `ind.${marca}@teste-soa.local`)
  await prisma.$executeRawUnsafe(`INSERT INTO "Lead" ("id","nome","telefone","workspaceId","parceiroId","createdAt") VALUES ($1,'Indicada','-',$2,$3,NOW())`, id('l'), ws, pA)
  // Atividade da semana p/ A: 3 cliques, 1 assinatura, comissões
  for (let i = 0; i < 3; i++) await prisma.$executeRawUnsafe(`INSERT INTO "ParceiroClique" ("id","parceiroId","via","criadoEm") VALUES ($1,$2,'link',NOW())`, id(`c${i}`), pA)
  await prisma.$executeRawUnsafe(`INSERT INTO "AsaasAssinatura" ("id","workspaceId","subscriptionId","parceiroId","createdAt") VALUES ($1,$2,$3,$4,NOW())`, id('ass'), ws, `sub_${marca}`, pA)
  await prisma.$executeRawUnsafe(`INSERT INTO "ParceiroComissao" ("id","parceiroId","workspaceId","base","percentual","valor","status","referencia","createdAt") VALUES ($1,$2,$3,29.90,30,8.97,'pago_via_split',$4,NOW())`, id('cm1'), pA, ws, `ref1_${marca}`)
  await prisma.$executeRawUnsafe(`INSERT INTO "ParceiroComissao" ("id","parceiroId","workspaceId","base","percentual","valor","status","referencia","createdAt") VALUES ($1,$2,$3,29.90,30,0,'pendente',$4,NOW())`, id('cm2'), pA, ws, `ref2_${marca}`)
  return { pA, ws }
}

async function main() {
  console.log('\n=== PROVA — TICKET 04 (notificações + resumo + copy) ===\n')
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
  console.log(`Banco: ${host}\n`)
  if (host.includes('ep-lively-firefly')) { console.error('❌ PRODUÇÃO — abortado'); process.exit(1) }
  if (String(process.env.PARCEIRAS_ATIVO || '').toLowerCase() !== 'on') { console.error('❌ rode com PARCEIRAS_ATIVO=on'); process.exit(1) }

  // ── [A] COPY VERBATIM + LGPD (funções puras) ────────────────────────────────
  console.log('[A] Copy final VERBATIM + LGPD')
  const apr = emailAprovacao('Maria Silva Souza', 'MARIA10')
  checar('aprovação: assunto', apr.assunto === '🎉 Bem-vinda ao Programa de Parceiras do SOA!')
  checar('aprovação: 1º nome + link + cupom + gancho 30 dias', apr.corpo.startsWith('Oi, Maria!') && apr.corpo.includes('Seu link exclusivo: usesoa.com.br/r/MARIA10') && apr.corpo.includes('Seu cupom: MARIA10') && apr.corpo.includes('30 dias grátis pra testar') && apr.corpo.trimEnd().endsWith('Equipe SOA'))
  checar('aprovação: LGPD sem sobrenome', !/Silva|Souza/.test(apr.corpo))
  const rec = emailRecusa('João Pedro Alves')
  checar('recusa: assunto + porta aberta + 1º nome', rec.assunto === 'Sobre sua candidatura ao Programa de Parceiras do SOA' && rec.corpo.startsWith('Oi, João,') && rec.corpo.includes('tentar de novo mais pra frente') && !/Pedro|Alves/.test(rec.corpo))
  const seg = emailSeguidoraTrial('Ana Clara Dias', 'Beatriz Rocha Lima', 'plano Mensal')
  checar('seguidora: assunto', seg.assunto === '✨ Uma seguidora sua entrou no SOA pelo seu link!')
  checar('seguidora: 1º nomes (parceira + indicada), sem sobrenome', seg.corpo.startsWith('Oi, Ana!') && seg.corpo.includes('Beatriz acabou de entrar no SOA pelo seu link e começou o teste do plano Mensal.') && !/Clara|Dias|Rocha|Lima/.test(seg.corpo))
  const res = emailResumoSemanal('Carla Nunes', { cliques: 5, cadastros: 2, assinaturas: 1, recebido: 'R$ 8,97', pendente: 'R$ 0,00' })
  checar('resumo com atividade: números na copy', res.assunto === '📊 Seu resumo da semana no SOA' && res.corpo.includes('👀 5 cliques no seu link') && res.corpo.includes('✍️ 2 novas indicadas cadastradas') && res.corpo.includes('🎉 1 assinaturas') && res.corpo.includes('💰 Total já recebido: R$ 8,97') && res.corpo.includes('⏳ A receber: R$ 0,00'))
  const resv = emailResumoSemanalSemNovidades('Carla Nunes', 'CARLA9')
  checar('resumo sem novidades: nudge + link', resv.corpo.includes('ainda não teve movimento') && resv.corpo.includes('usesoa.com.br/r/CARLA9'))

  // ── [B] competência ISO (idempotência semanal) ──────────────────────────────
  console.log('\n[B] Competência ISO da semana')
  checar('formato AAAA-Www', /^\d{4}-W\d{2}$/.test(competenciaSemana(new Date('2026-07-23T12:00:00Z'))))
  checar('seg..sex = mesma semana', competenciaSemana(new Date('2026-07-20T00:00:00Z')) === competenciaSemana(new Date('2026-07-24T00:00:00Z')))
  checar('semana seguinte difere', competenciaSemana(new Date('2026-07-24T00:00:00Z')) !== competenciaSemana(new Date('2026-07-31T00:00:00Z')))

  const { pA, ws } = await semear()
  try {
    // ── [C] NOTIFICAÇÃO seguidora-trial (wiring real + idempotência) ───────────
    console.log('\n[C] Notificação "seguidora entrou" — dispara 1×, idempotente')
    const emailPA = `pA.${marca}@teste-soa.local`
    const antes = enviados.length
    await avisarParceiraSeguidoraTrial(ws)
    const eNotif = ultimoPara(emailPA)
    checar('disparou 1 e-mail à parceira', enviados.length === antes + 1 && !!eNotif)
    checar('assunto correto', eNotif?.subject === '✨ Uma seguidora sua entrou no SOA pelo seu link!')
    checar('LGPD: só 1º nome da indicada (Fulana), sem sobrenome nem @', /Fulana/.test(eNotif?.html || '') && !/SEGREDOSOBRENOME|Silva/.test(eNotif?.html || '') && !/@/.test(eNotif?.html || ''))
    checar('plano correto na copy (plano Mensal)', /começou o teste do plano Mensal/.test(eNotif?.html || ''))
    await avisarParceiraSeguidoraTrial(ws) // reentrega
    checar('idempotente: NÃO reenvia', enviados.length === antes + 1)
    const [{ n: nAviso }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int n FROM "AssinaturaAviso" WHERE "workspaceId"=$1 AND "tipo"='PARCEIRA_SEGUIDORA_TRIAL'`, ws)
    checar('1 marca de idempotência (não duplica)', nAviso === 1, `n=${nAviso}`)

    // ── [D] RESUMO SEMANAL (agregação + variante + idempotência) ───────────────
    console.log('\n[D] Resumo semanal — agrega certo, variante certa, idempotente')
    const comp = competenciaSemana(new Date())
    const emailPB = `pB.${marca}@teste-soa.local`
    const r1 = await enviarResumosSemanais()
    const eA = ultimoPara(emailPA), eB = ultimoPara(emailPB)
    checar('parceira A recebeu resumo COM atividade', !!eA && eA.subject === '📊 Seu resumo da semana no SOA' && /👀 3 cliques/.test(eA.html) && /✍️ 1 novas indicadas/.test(eA.html) && /🎉 1 assinaturas/.test(eA.html))
    checar('A: ganhos agregados corretos (recebido R$8,97 · a receber R$8,97)', /💰 Total já recebido: R\$\s*8,97/.test(eA?.html || '') && /⏳ A receber: R\$\s*8,97/.test(eA?.html || ''))
    checar('A: LGPD sem @ nem nome de indicada', !/@/.test(eA?.html || '') && !/Fulana|SEGREDOSOBRENOME/.test(eA?.html || ''))
    checar('parceira B recebeu variante SEM novidades + link', !!eB && /ainda não teve movimento/.test(eB.html) && new RegExp(`usesoa.com.br/r/T04B${marca.toUpperCase()}`).test(eB.html))
    const marcaEnvios = enviados.length
    const r2 = await enviarResumosSemanais() // 2ª rodada mesma semana
    checar('idempotente por semana: 2ª rodada não reenvia A/B', !ultimoPara(emailPA) || enviados.length === marcaEnvios, `envios ${marcaEnvios}→${enviados.length}`)
    const [{ n: nRA }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int n FROM "ParceiroAviso" WHERE "parceiroId"=$1 AND "tipo"='RESUMO_SEMANAL' AND "competencia"=$2`, pA, comp)
    checar('1 ParceiroAviso por (parceira, semana)', nRA === 1, `n=${nRA}`)

  } finally {
    console.log('\n[limpeza dev]')
    for (const ws of seed.ws) for (const t of ['ParceiroComissao', 'AsaasAssinatura', 'AssinaturaAviso', 'Lead', 'User', 'Workspace'])
      await prisma.$executeRawUnsafe(`DELETE FROM "${t}" WHERE "${t === 'Workspace' ? 'id' : 'workspaceId'}"=$1`, ws).catch(() => {})
    for (const p of seed.parc) for (const t of ['ParceiroClique', 'ParceiroComissao', 'ParceiroAviso', 'Lead', 'Parceiro'])
      await prisma.$executeRawUnsafe(`DELETE FROM "${t}" WHERE "${t === 'Parceiro' ? 'id' : 'parceiroId'}"=$1`, p).catch(() => {})
    global.fetch = realFetch
    console.log('  🧹 limpo')
  }
  console.log(`\n${falhas === 0 ? '✅ TICKET 04 PASSOU' : `❌ ${falhas} falha(s)`}\n`)
  process.exit(falhas === 0 ? 0 : 1)
}
main().catch(e => { console.error('\n❌ Erro:', e.message, e.stack, '\n'); process.exit(1) })
