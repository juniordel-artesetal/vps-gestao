// PROVA — dual-identidade (parceira que também é artesã). Resolver de sessão,
// vínculo por userId, link por e-mail na candidatura.
//   node --experimental-strip-types --import ./scripts/_loader-alias.mjs \
//     --env-file=.env --env-file=.env.local scripts/provar-parceira-dual.mjs
import { prisma } from '../lib/prisma.ts'
import { resolverParceiroDaSessao, vinculoDaArtesa } from '../lib/parceiras/sessao.ts'
import { criarCandidatura } from '../lib/parceiras/candidatura.ts'

const marca = Date.now().toString(36)
const WS = `dual_${marca}`
let falhas = 0
const checar = (n, ok, d = '') => { if (!ok) falhas++; console.log(`  ${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`) }
const uid = (t) => `${t}_${marca}`
const ids = { parc: [] }

async function main() {
  console.log('\n=== PROVA — dual-identidade parceira/artesã ===\n')
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
  if (host.includes('ep-lively-firefly')) { console.error('❌ PRODUÇÃO'); process.exit(1) }

  const emailArtesa = `art.${marca}@teste-soa.local`
  await prisma.$executeRawUnsafe(`INSERT INTO "Workspace" ("id","nome","slug","ativo","createdAt","updatedAt") VALUES ($1,$2,$3,true,NOW(),NOW())`, WS, `WS ${marca}`, `ws-${marca}`)
  await prisma.$executeRawUnsafe(`INSERT INTO "User" ("id","workspaceId","nome","email","senha","role","ativo","primeiroLogin","createdAt") VALUES ($1,$2,'Maria Artesã',$3,'x','ADMIN',true,false,NOW())`, uid('u'), WS, emailArtesa)
  // Parceiro vinculado à artesã (aprovada)
  await prisma.$executeRawUnsafe(`INSERT INTO "Parceiro" ("id","tipo","nome","email","userId","status","ativo","cupom","linkSlug","senhaCripto","comissaoPercMensal","comissaoPercAnual","comissaoRecorrente","createdAt") VALUES ($1,'influencer','Maria',$2,$3,'aprovada',true,$4,$4,'x',30,40,true,NOW())`, uid('pLink'), emailArtesa, uid('u'), `MARIA${marca.toUpperCase()}`)
  ids.parc.push(uid('pLink'))

  try {
    console.log('[resolver de sessão]')
    checar('parceira PURA (role=parceira) → parceiroId direto', await resolverParceiroDaSessao({ user: { role: 'parceira', parceiroId: 'p_puro', id: 'p_puro' } }) === 'p_puro')
    const rArt = await resolverParceiroDaSessao({ user: { role: 'ADMIN', id: uid('u') } })
    const [dbg] = await prisma.$queryRawUnsafe(`SELECT "userId" FROM "Parceiro" WHERE "id"=$1`, uid('pLink'))
    checar('artesã logada → Parceiro vinculado pelo userId', rArt === uid('pLink'), `resolver=${rArt} pLink.userId=${dbg?.userId} esperado=${uid('u')}`)
    checar('artesã SEM parceria vinculada → null', await resolverParceiroDaSessao({ user: { role: 'ADMIN', id: 'sem_vinculo' } }) === null)

    console.log('\n[vínculo p/ botão em /modulos]')
    const v = await vinculoDaArtesa(uid('u'))
    checar('vínculo: vinculada + aprovada', v.vinculada && v.aprovada && v.completo)
    const vn = await vinculoDaArtesa('sem_vinculo')
    checar('sem vínculo: vinculada=false', !vn.vinculada && !vn.aprovada)

    console.log('\n[candidatura vincula userId por e-mail]')
    // candidata com o MESMO e-mail de uma artesã existente → vincula
    const emailArt2 = `art2.${marca}@teste-soa.local`
    await prisma.$executeRawUnsafe(`INSERT INTO "User" ("id","workspaceId","nome","email","senha","role","ativo","primeiroLogin","createdAt") VALUES ($1,$2,'Bia',$3,'x','ADMIN',true,false,NOW())`, uid('u2'), WS, emailArt2)
    const c1 = await criarCandidatura({ nome: 'Bia', whatsapp: '(11) 98888-7777', email: emailArt2, instagram: '@bia' })
    if (c1.parceiroId) ids.parc.push(c1.parceiroId)
    const [p1] = await prisma.$queryRawUnsafe(`SELECT "userId" FROM "Parceiro" WHERE "id"=$1`, c1.parceiroId)
    checar('candidatura com e-mail de artesã existente → userId vinculado', c1.ok && p1?.userId === uid('u2'))

    // candidata com e-mail SEM artesã → userId null
    const c2 = await criarCandidatura({ nome: 'Nova', whatsapp: '(11) 97777-6666', email: `nova.${marca}@teste-soa.local`, instagram: '@nova' })
    if (c2.parceiroId) ids.parc.push(c2.parceiroId)
    const [p2] = await prisma.$queryRawUnsafe(`SELECT "userId" FROM "Parceiro" WHERE "id"=$1`, c2.parceiroId)
    checar('candidatura sem artesã correspondente → userId null', c2.ok && p2?.userId === null)

    console.log('\n[backfill por e-mail — idempotente]')
    // cria um Parceiro antigo sem userId com e-mail = artesã, roda o UPDATE do backfill
    await prisma.$executeRawUnsafe(`INSERT INTO "Parceiro" ("id","tipo","nome","email","status","ativo","createdAt") VALUES ($1,'influencer','Velha',$2,'pendente',false,NOW())`, uid('pOld'), emailArtesa)
    ids.parc.push(uid('pOld'))
    await prisma.$executeRawUnsafe(`UPDATE "Parceiro" p SET "userId"=u."id" FROM "User" u WHERE p."userId" IS NULL AND p."email" IS NOT NULL AND lower(p."email")=lower(u."email")`)
    const [pOld] = await prisma.$queryRawUnsafe(`SELECT "userId" FROM "Parceiro" WHERE "id"=$1`, uid('pOld'))
    checar('backfill vincula parceiro antigo por e-mail', pOld?.userId === uid('u'))

  } finally {
    console.log('\n[limpeza]')
    for (const id of ids.parc) await prisma.$executeRawUnsafe(`DELETE FROM "Parceiro" WHERE "id"=$1`, id).catch(() => {})
    await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE "workspaceId"=$1`, WS).catch(() => {})
    await prisma.$executeRawUnsafe(`DELETE FROM "Workspace" WHERE "id"=$1`, WS).catch(() => {})
    console.log('  🧹 limpo')
  }
  console.log(`\n${falhas === 0 ? '✅ DUAL-IDENTIDADE PASSOU' : `❌ ${falhas} falha(s)`}\n`)
  process.exit(falhas === 0 ? 0 : 1)
}
main().catch(e => { console.error('❌', e.message, e.stack); process.exit(1) })
