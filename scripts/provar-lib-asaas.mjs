// ─────────────────────────────────────────────────────────────────────────────
// PROVA das funções REAIS de lib/pagamento/asaas — Asaas sandbox + persistência.
//
// USO (a ORDEM dos --env-file importa: o último vence):
//   node --experimental-strip-types --import ./scripts/_loader-alias.mjs \
//        --env-file=.env --env-file=.env.local scripts/provar-lib-asaas.mjs
//
// .env       → segredos gerais; NÃO duplicar segredo no .env.local — chave repetida
//              em dois arquivos diverge uma hora.
// .env.local → DATABASE_URL/DIRECT_URL do branch Neon de DEV, ASAAS_API_KEY sandbox
//              e ASAAS_TOKEN_KEY (cripto das credenciais; cai em LOGISTICA_TOKEN_KEY)
//
// Diferente de provar-asaas-sandbox.mjs (que fala direto com a API), este exercita
// testarConexao / garantirCliente / criarCobranca / criarAssinatura / montarSplitComissao
// e confere as LINHAS que elas gravam. É o que fecha o caminho lib → Asaas → banco.
//
// 🔒 A API key nunca é impressa.  ⚠️ Sandbox apenas; nada de payout.
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from '../lib/prisma.ts'
import {
  testarConexao, garantirCliente, criarCobranca, criarAssinatura,
  montarSplitComissao, liquidoEstimado, getConfigPublica,
} from '../lib/pagamento/asaas/index.ts'
import { expurgarPayloadsAntigos, DIAS_RETENCAO_PAYLOAD } from '../lib/pagamento/asaas/webhook.ts'

let falhas = 0
function checar(nome, ok, detalhe = '') {
  if (!ok) falhas++
  console.log(`  ${ok ? '✅' : '❌'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
}

const marca = Date.now().toString(36)
const WS_TESTE = `ws_teste_${marca}`
const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const amanha = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

async function main() {
  console.log('\n=== PROVA DA LIB — lib/pagamento/asaas (sandbox + persistência) ===\n')

  // A lib exige o módulo LIGADO para operar (feature flag). Ligamos só durante o teste.
  await prisma.$executeRaw`
    INSERT INTO "AsaasConfig" ("id","escopo","conectado","sandbox","ativo","updatedAt")
    SELECT ${gerarId()}, 'plataforma', true, true, true, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM "AsaasConfig" WHERE "escopo" = 'plataforma')`
  await prisma.$executeRaw`
    UPDATE "AsaasConfig" SET "ativo" = true, "conectado" = true WHERE "escopo" = 'plataforma'`

  const cfg = await getConfigPublica()
  console.log(`Ambiente: ${cfg.sandbox ? 'SANDBOX' : '⚠️ PRODUÇÃO'} · chave: ${cfg.temApiKey ? 'presente' : 'AUSENTE'}\n`)
  if (!cfg.sandbox) { console.error('❌ Não é sandbox. Abortando.\n'); process.exitCode = 1; return }

  // ── [1] testarConexao()
  console.log('[1] testarConexao()')
  const t = await testarConexao()
  checar('ok', t.ok === true, t.erro ?? '')
  checar('walletId começa com "ba72bf2f"', String(t.dados?.walletId).startsWith('ba72bf2f'), t.dados?.walletId ?? '—')
  checar('conta identificada', !!t.dados?.nome, t.dados?.nome ?? '')

  const [diag] = await prisma.$queryRaw`
    SELECT "conectado","ultimoTesteOk","walletIdPlataforma","contaNome"
    FROM "AsaasConfig" WHERE "escopo" = 'plataforma' LIMIT 1`
  checar('diagnóstico gravado no banco', diag?.ultimoTesteOk === true && diag?.conectado === true)
  checar('walletId persistido', String(diag?.walletIdPlataforma).startsWith('ba72bf2f'), diag?.walletIdPlataforma ?? '—')

  // ── [2] garantirCliente() + criarCobranca()
  console.log('\n[2] garantirCliente() + criarCobranca() R$ 5,00 PIX')
  const cli = await garantirCliente(WS_TESTE, {
    name: `Ateliê Teste SOA ${marca}`,
    cpfCnpj: '24971563792',                   // CPF fictício de sandbox
    email: `teste-${marca}@exemplo.com.br`,
  })
  checar('cliente criado', cli.ok === true && !!cli.dados?.customerId, cli.erro ?? cli.dados?.customerId)

  const [linhaCli] = await prisma.$queryRaw`
    SELECT "customerId","sandbox","nome","email" FROM "AsaasCliente"
    WHERE "workspaceId" = ${WS_TESTE} LIMIT 1`
  checar('linha em AsaasCliente', !!linhaCli, linhaCli?.customerId ?? '')
  checar('marcada como sandbox', linhaCli?.sandbox === true)
  checar('CPF NÃO foi persistido', !JSON.stringify(linhaCli ?? {}).includes('24971563792'))

  // idempotência: 2ª chamada não cria outro cliente
  const cli2 = await garantirCliente(WS_TESTE, { name: 'x', cpfCnpj: '24971563792' })
  checar('2ª chamada reusa o mesmo customerId', cli2.dados?.customerId === cli.dados?.customerId)
  const [{ n: nCli }] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS "n" FROM "AsaasCliente" WHERE "workspaceId" = ${WS_TESTE}`
  checar('continua 1 linha só', nCli === 1, `linhas: ${nCli}`)

  const cob = await criarCobranca({
    workspaceId: WS_TESTE, customerId: cli.dados.customerId,
    valor: 5.00, vencimento: amanha(), forma: 'PIX',
    descricao: 'Cobrança de teste — fundação Asaas',
    referencia: `teste-sandbox-${marca}`, finalidade: 'teste-sandbox',
  })
  checar('cobrança criada', cob.ok === true, cob.erro ?? cob.dados?.paymentId)
  checar('invoiceUrl retornada', !!cob.dados?.invoiceUrl)

  const [linhaCob] = await prisma.$queryRaw`
    SELECT "paymentId","valor"::float AS "valor","status","finalidade","billingType","sandbox"
    FROM "AsaasCobranca" WHERE "paymentId" = ${cob.dados?.paymentId ?? ''} LIMIT 1`
  checar('linha em AsaasCobranca', !!linhaCob)
  checar('valor 5.00', linhaCob?.valor === 5, String(linhaCob?.valor))
  checar('finalidade "teste-sandbox"', linhaCob?.finalidade === 'teste-sandbox', linhaCob?.finalidade)
  checar('billingType PIX', linhaCob?.billingType === 'PIX', linhaCob?.billingType)
  console.log(`\n     🔗 invoiceUrl: ${cob.dados?.invoiceUrl}\n`)

  // ── [3] criarAssinatura()
  console.log('[3] criarAssinatura() MONTHLY (sem split)')
  const ass = await criarAssinatura({
    workspaceId: WS_TESTE, customerId: cli.dados.customerId,
    valor: 5.00, primeiroVencimento: amanha(), ciclo: 'MONTHLY', forma: 'PIX',
    descricao: 'Assinatura de teste — fundação Asaas', referencia: `teste-sandbox-${marca}`,
  })
  checar('assinatura criada', ass.ok === true, ass.erro ?? ass.dados?.subscriptionId)

  const [linhaAss] = await prisma.$queryRaw`
    SELECT "subscriptionId","ciclo","valor"::float AS "valor","status","workspaceId","proximoVencimento"
    FROM "AsaasAssinatura" WHERE "subscriptionId" = ${ass.dados?.subscriptionId ?? ''} LIMIT 1`
  checar('linha em AsaasAssinatura', !!linhaAss)
  checar('ciclo MONTHLY', linhaAss?.ciclo === 'MONTHLY', linhaAss?.ciclo)
  checar('workspaceId correto', linhaAss?.workspaceId === WS_TESTE)
  checar('status ACTIVE', linhaAss?.status === 'ACTIVE', linhaAss?.status)

  // ── [4] guarda de estouro (função real da lib)
  console.log('\n[4] montarSplitComissao() — guarda de estouro')
  const wFake = 'ba72bf2f-0000-0000-0000-000000000000'
  const cabe = montarSplitComissao({ walletId: wFake, valorComissao: 1.50, valorCobranca: 5, forma: 'PIX' })
  checar('comissão que cabe é aceita', cabe.ok === true && cabe.split.length === 1,
    cabe.ok ? `fixedValue=${cabe.split[0].fixedValue} (líquido ${liquidoEstimado(5, 'PIX')})` : cabe.erro)
  const estoura = montarSplitComissao({ walletId: wFake, valorComissao: 4.00, valorCobranca: 5, forma: 'PIX' })
  checar('comissão que estoura é RECUSADA', estoura.ok === false)
  console.log(`     ↳ "${estoura.erro}"`)
  const micro = montarSplitComissao({ walletId: wFake, valorComissao: 0.30, valorCobranca: 1, forma: 'PIX' })
  checar('cobrança menor que a taxa é RECUSADA', micro.ok === false)
  console.log(`     ↳ "${micro.erro}"`)
  checar('sem walletId → sem split, sem erro',
    montarSplitComissao({ walletId: null, valorComissao: 1, valorCobranca: 50 }).ok === true)

  // ── [5] expurgo de payload (retenção de 90 dias)
  console.log(`\n[5] expurgarPayloadsAntigos() — retenção de ${DIAS_RETENCAO_PAYLOAD} dias`)
  const idVelho = gerarId(), idNovo = gerarId()
  await prisma.$executeRaw`
    INSERT INTO "AsaasWebhookEvento" ("id","eventoId","evento","payload","createdAt")
    VALUES (${idVelho}, ${'evt_velho_' + marca}, 'PAYMENT_RECEIVED',
            ${JSON.stringify({ payment: { id: 'pay_velho' } })}::jsonb, NOW() - INTERVAL '100 days')`
  await prisma.$executeRaw`
    INSERT INTO "AsaasWebhookEvento" ("id","eventoId","evento","payload","createdAt")
    VALUES (${idNovo}, ${'evt_novo_' + marca}, 'PAYMENT_RECEIVED',
            ${JSON.stringify({ payment: { id: 'pay_novo' } })}::jsonb, NOW() - INTERVAL '10 days')`

  const afetados = await expurgarPayloadsAntigos()
  checar('expurgou exatamente 1 linha (a de 100 dias)', afetados === 1, `afetados: ${afetados}`)

  const [velho] = await prisma.$queryRaw`
    SELECT "eventoId","evento","payload","createdAt" FROM "AsaasWebhookEvento" WHERE "id" = ${idVelho}`
  checar('payload do antigo apagado', velho?.payload === null)
  checar('LINHA do antigo preservada', !!velho?.eventoId, velho?.eventoId)
  checar('metadados preservados (evento)', velho?.evento === 'PAYMENT_RECEIVED')

  const [novo] = await prisma.$queryRaw`
    SELECT "payload" FROM "AsaasWebhookEvento" WHERE "id" = ${idNovo}`
  checar('payload do recente INTACTO', novo?.payload !== null)

  // ── limpeza
  console.log('\n[limpeza] removendo dados de teste do banco')
  await prisma.$executeRaw`DELETE FROM "AsaasWebhookEvento" WHERE "id" IN (${idVelho}, ${idNovo})`
  await prisma.$executeRaw`DELETE FROM "AsaasCobranca"   WHERE "workspaceId" = ${WS_TESTE}`
  await prisma.$executeRaw`DELETE FROM "AsaasAssinatura" WHERE "workspaceId" = ${WS_TESTE}`
  await prisma.$executeRaw`DELETE FROM "AsaasCliente"    WHERE "workspaceId" = ${WS_TESTE}`
  await prisma.$executeRaw`UPDATE "AsaasConfig" SET "ativo" = false WHERE "escopo" = 'plataforma'`
  console.log('  ✅ limpo (flag revertida para OFF)')
  console.log('  ℹ️  cliente/cobrança/assinatura CONTINUAM no sandbox do Asaas (ver dúvida 4)')

  console.log(`\n${falhas === 0 ? '✅ TODAS as provas passaram' : `❌ ${falhas} prova(s) falharam`}\n`)
  process.exitCode = falhas === 0 ? 0 : 1
}

main()
  .catch(e => { console.error('\n❌ Erro:', String(e.message).replace(/\$aact_[\w+/=-]+/g, '[REDACTED]'), '\n'); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
