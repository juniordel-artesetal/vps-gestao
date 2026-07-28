// PROVA (SANDBOX) — /migrar: assinatura CARTÃO + cupom R$20 na 1ª cobrança (→ 9,90).
// Replica a sequência Asaas do endpoint + valida o cupom pela whitelist. Limpa tudo.
import { prisma } from '../lib/prisma.ts'
import { garantirCliente, criarAssinatura, sincronizarCobrancasDaAssinatura } from '../lib/pagamento/asaas/index.ts'
import { chamarAsaas } from '../lib/pagamento/asaas/client.ts'
import { validarCupomMigracao, marcarCupomUsado } from '../lib/campanha/cupom.ts'

const marca = Date.now().toString(36)
const WS = `mig_${marca}`
const EMAIL = `mig.${marca}@teste-soa.local`
const CPF = '24971563792'
let falhas = 0
const checar = (n, ok, d = '') => { if (!ok) falhas++; console.log(`  ${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`) }

async function main() {
  console.log('\n=== PROVA — /migrar (sandbox): cartão + cupom R$20 ===\n')
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
  if (host.includes('ep-lively-firefly')) { console.error('❌ PRODUÇÃO'); process.exit(1) }

  await prisma.$executeRawUnsafe(`INSERT INTO "Workspace" ("id","nome","slug","ativo","createdAt","updatedAt") VALUES ($1,$2,$3,true,NOW(),NOW())`, WS, `WS ${marca}`, `ws-${marca}`)
  await prisma.$executeRawUnsafe(`INSERT INTO "CampanhaMigracao" ("id","email","primeiroNome","estado","dataInicio","createdAt","updatedAt") VALUES ($1,$2,'Maria','pendente',CURRENT_DATE,NOW(),NOW())`, `cm_${marca}`, EMAIL)
  let subId
  try {
    checar('cupom válido antes de usar (whitelist)', (await validarCupomMigracao(EMAIL)).valido === true)

    const cli = await garantirCliente(WS, { name: 'Maria', cpfCnpj: CPF, email: EMAIL, externalReference: WS })
    checar('cliente Asaas criado', cli.ok && !!cli.dados?.customerId)
    const ass = await criarAssinatura({ workspaceId: WS, customerId: cli.dados.customerId, valor: 29.9, primeiroVencimento: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10), ciclo: 'MONTHLY', forma: 'CREDIT_CARD', descricao: 'SOA — plano Mensal', referencia: WS })
    subId = ass.dados?.subscriptionId
    checar('assinatura CARTÃO criada (aparece em Assinaturas)', ass.ok && !!subId)

    const sub = await chamarAsaas(`/subscriptions/${subId}`, { exigirAtivo: false })
    checar('billingType CREDIT_CARD + MONTHLY + 29,90', sub.dados?.billingType === 'CREDIT_CARD' && sub.dados?.cycle === 'MONTHLY' && Number(sub.dados?.value) === 29.9)

    const sync = await sincronizarCobrancasDaAssinatura(subId, WS)
    const cob = sync.dados?.[0]
    checar('1ª cobrança existe', !!cob?.paymentId)

    // aplica o cupom R$20 na 1ª cobrança
    const desc = await chamarAsaas(`/payments/${cob.paymentId}`, { metodo: 'POST', corpo: { discount: { value: 20, dueDateLimitDays: 0, type: 'FIXED' } } })
    checar('desconto R$20 aplicado na 1ª cobrança', desc.ok)
    if (desc.ok) await marcarCupomUsado(EMAIL)

    const pg = await chamarAsaas(`/payments/${cob.paymentId}`, { exigirAtivo: false })
    const descValor = Number(pg.dados?.discount?.value ?? 0)
    checar('🎯 1º mês = 9,90 (desconto de 20 sobre 29,90)', descValor === 20, `desconto=${descValor} valor=${pg.dados?.value}`)

    checar('cupom vira uso único (recusado após aplicar)', (await validarCupomMigracao(EMAIL)).valido === false)
  } finally {
    console.log('\n[limpeza sandbox + dev]')
    if (subId) { const d = await chamarAsaas(`/subscriptions/${subId}`, { metodo: 'DELETE', exigirAtivo: false }).catch(() => {}); console.log('  sub removida:', d?.ok ?? 'erro') }
    for (const t of ['AsaasCobranca', 'AsaasAssinatura', 'AsaasCliente', 'CampanhaMigracao', 'Workspace'])
      await prisma.$executeRawUnsafe(`DELETE FROM "${t}" WHERE "${t === 'Workspace' ? 'id' : t === 'CampanhaMigracao' ? 'email' : 'workspaceId'}"=$1`, t === 'CampanhaMigracao' ? EMAIL : WS).catch(() => {})
    console.log('  🧹 limpo')
  }
  console.log(`\n${falhas === 0 ? '✅ MIGRAR PASSOU' : `❌ ${falhas} falha(s)`}\n`)
  process.exit(falhas === 0 ? 0 : 1)
}
main().catch(e => { console.error('❌', e.message, e.stack); process.exit(1) })
