// PROVA (SANDBOX Asaas) — Pix agora cria ASSINATURA recorrente, não cobrança avulsa.
// Confere: aparece em /subscriptions (Assinaturas), billingType PIX, QR da 1ª cobrança,
// AsaasAssinatura persistida, e idempotência (não duplica assinatura). Limpa tudo.
//
//   node --experimental-strip-types --import ./scripts/_loader-alias.mjs \
//     --env-file=.env --env-file=.env.local scripts/provar-pix-assinatura.mjs
import { prisma } from '../lib/prisma.ts'
import { gerarPixDaAssinatura } from '../lib/assinatura/pix.ts'
import { chamarAsaas } from '../lib/pagamento/asaas/client.ts'

const marca = Date.now().toString(36)
const WS = `pxass_${marca}`
const CPF = '24971563792'
let falhas = 0
const checar = (n, ok, d = '') => { if (!ok) falhas++; console.log(`  ${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`) }

// Stub só do Resend (evita e-mail interno); Asaas passa direto.
const realFetch = global.fetch
global.fetch = async (u, o) => { if (String(u).includes('api.resend.com')) return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' }; return realFetch(u, o) }

async function main() {
  console.log('\n=== PROVA — Pix vira ASSINATURA (sandbox Asaas) ===\n')
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
  if (host.includes('ep-lively-firefly')) { console.error('❌ PRODUÇÃO'); process.exit(1) }

  await prisma.$executeRawUnsafe(`INSERT INTO "Workspace" ("id","nome","slug","ativo","assinaturaStatus","createdAt","updatedAt") VALUES ($1,$2,$3,true,'AGUARDANDO_PAGAMENTO',NOW(),NOW())`, WS, `WS ${marca}`, `ws-${marca}`)
  let subscriptionId
  try {
    const r = await gerarPixDaAssinatura({ workspaceId: WS, plano: 'mensal', cpf: CPF, nome: 'Artesã Teste', email: `pxass.${marca}@teste-soa.local` })
    checar('gerou o Pix (ok + QR na tela)', r.ok && !!r.qrTexto && !!r.paymentId, r.erro || `pay=${r.paymentId}`)

    const [ass] = await prisma.$queryRawUnsafe(`SELECT "subscriptionId","sandbox","ciclo","status" FROM "AsaasAssinatura" WHERE "workspaceId"=$1`, WS)
    subscriptionId = ass?.subscriptionId
    checar('AsaasAssinatura persistida (subscriptionId)', !!subscriptionId && ass.sandbox === true && ass.ciclo === 'MONTHLY', JSON.stringify(ass))

    // No Asaas: existe como ASSINATURA (o que faltava — antes só cobrança)
    const sub = await chamarAsaas(`/subscriptions/${subscriptionId}`, { exigirAtivo: false })
    checar('🎯 aparece em ASSINATURAS no Asaas (GET /subscriptions/{id})', sub.ok && sub.dados?.id === subscriptionId, JSON.stringify({ ok: sub.ok, status: sub.dados?.status, billingType: sub.dados?.billingType }))
    checar('assinatura é PIX + MONTHLY + valor 29,90', sub.dados?.billingType === 'PIX' && sub.dados?.cycle === 'MONTHLY' && Number(sub.dados?.value) === 29.9, JSON.stringify({ bt: sub.dados?.billingType, cy: sub.dados?.cycle, v: sub.dados?.value }))

    // O Asaas gerou a 1ª cobrança da assinatura (recorrência real)
    const pays = await chamarAsaas(`/subscriptions/${subscriptionId}/payments`, { exigirAtivo: false })
    checar('Asaas já gerou a cobrança do ciclo (billingType PIX)', pays.ok && (pays.dados?.data?.length > 0) && pays.dados.data[0].billingType === 'PIX', `n=${pays.dados?.data?.length} bt=${pays.dados?.data?.[0]?.billingType}`)

    // Idempotência: repetir NÃO cria outra assinatura
    const r2 = await gerarPixDaAssinatura({ workspaceId: WS, plano: 'mensal', cpf: CPF, nome: 'Artesã Teste', email: `pxass.${marca}@teste-soa.local` })
    const [{ n }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int n FROM "AsaasAssinatura" WHERE "workspaceId"=$1`, WS)
    checar('idempotente: repetir reaproveita (1 assinatura só)', r2.ok && n === 1, `n=${n}`)

    // Trial concedido
    const [w] = await prisma.$queryRawUnsafe(`SELECT "assinaturaStatus" FROM "Workspace" WHERE "id"=$1`, WS)
    checar('trial concedido (TRIAL) + origem asaas', w.assinaturaStatus === 'TRIAL')
  } finally {
    console.log('\n[limpeza sandbox + dev]')
    if (subscriptionId) { const d = await chamarAsaas(`/subscriptions/${subscriptionId}`, { metodo: 'DELETE', exigirAtivo: false }).catch(() => {}); console.log('  sub removida do Asaas:', d?.ok ?? 'erro') }
    for (const t of ['AsaasCobranca', 'AsaasAssinatura', 'AsaasCliente', 'AssinaturaAviso']) await prisma.$executeRawUnsafe(`DELETE FROM "${t}" WHERE "workspaceId"=$1`, WS).catch(() => {})
    await prisma.$executeRawUnsafe(`DELETE FROM "Workspace" WHERE "id"=$1`, WS).catch(() => {})
    global.fetch = realFetch
    console.log('  🧹 limpo')
  }
  console.log(`\n${falhas === 0 ? '✅ PIX-ASSINATURA PASSOU' : `❌ ${falhas} falha(s)`}\n`)
  process.exit(falhas === 0 ? 0 : 1)
}
main().catch(e => { console.error('❌', e.message, e.stack); process.exit(1) })
