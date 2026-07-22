// ─────────────────────────────────────────────────────────────────────────────
// PROVA REAL no SANDBOX do Asaas — só leitura + criações de teste.
//
// USO (a ORDEM dos --env-file importa: o último vence):
//   node --env-file=.env --env-file=.env.local scripts/provar-asaas-sandbox.mjs
//   node --env-file=.env --env-file=.env.local scripts/provar-asaas-sandbox.mjs --criar
//
// .env       → LOGISTICA_TOKEN_KEY e demais segredos (NÃO duplicar no .env.local)
// .env.local → DATABASE_URL/DIRECT_URL do branch Neon de DEV + ASAAS_API_KEY sandbox
//
// Este script fala DIRETO com a API do Asaas (não passa pela lib nem pelo banco) —
// serve para isolar problemas de credencial/contrato. Para provar o caminho da lib
// COM persistência, use provar-lib-asaas.mjs.
// ⚠️ --criar cria cliente/cobrança/assinatura de verdade no sandbox.
//
// 🔒 A API key nunca é impressa. Só o prefixo de ambiente ($aact_hmlg_ = sandbox).
// ⚠️ NÃO cria webhook no painel. NÃO faz transferência/payout.
// ─────────────────────────────────────────────────────────────────────────────
const CRIAR = process.argv.includes('--criar')

const API_KEY = (process.env.ASAAS_API_KEY || '').trim()
const SANDBOX = API_KEY.includes('_hmlg_')
const BASE = SANDBOX ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3'

let falhas = 0
function checar(nome, ok, detalhe = '') {
  if (!ok) falhas++
  console.log(`  ${ok ? '✅' : '❌'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
}

// Mesma sanitização de lib/pagamento/asaas/client.ts: se o Asaas ecoar a chave
// numa mensagem de erro, ela não chega ao output.
const limparSegredo = (t) => String(t).replace(/\$aact_[A-Za-z0-9+/=_-]+/g, '[REDACTED]')

async function asaas(caminho, { metodo = 'GET', corpo } = {}) {
  const resp = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: { access_token: API_KEY, 'Content-Type': 'application/json', 'User-Agent': 'SOA-VPS-Gestao' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(20_000),
  })
  const texto = await resp.text()
  let dados = null
  try { dados = texto ? JSON.parse(texto) : null } catch {}
  if (!resp.ok) {
    const errs = dados?.errors?.map(e => e.description || e.code).join('; ')
    throw new Error(limparSegredo(errs || `Asaas respondeu ${resp.status}`))
  }
  return dados
}

// ── Réplica EXATA da regra de lib/pagamento/asaas/index.ts (prova 4, sem rede).
const TAXA_ESTIMADA = {
  PIX: { perc: 0, fixo: 1.99 },
  BOLETO: { perc: 0, fixo: 1.99 },
  CREDIT_CARD: { perc: 2.99, fixo: 0.49 },
  UNDEFINED: { perc: 2.99, fixo: 1.99 },
}
function liquidoEstimado(valor, forma = 'UNDEFINED') {
  const t = TAXA_ESTIMADA[forma] ?? TAXA_ESTIMADA.UNDEFINED
  return Math.round((valor - (valor * t.perc / 100) - t.fixo) * 100) / 100
}
function montarSplitComissao({ walletId, valorComissao, valorCobranca, forma, descricao }) {
  const valor = Math.round(valorComissao * 100) / 100
  if (!walletId || !(valor > 0)) return { ok: true, split: [] }
  const liquido = liquidoEstimado(valorCobranca, forma ?? 'UNDEFINED')
  if (liquido <= 0) return { ok: false, erro: `Cobrança de R$ ${valorCobranca.toFixed(2)} não cobre nem a taxa do Asaas — split impossível.` }
  if (valor > liquido) return { ok: false, erro: `Comissão de R$ ${valor.toFixed(2)} excede o líquido estimado da cobrança (R$ ${liquido.toFixed(2)}). Reduza o percentual do parceiro ou aumente o valor do plano.` }
  return { ok: true, split: [{ walletId, fixedValue: valor, description: descricao?.slice(0, 100) }] }
}

const amanha = () => {
  const d = new Date(Date.now() + 86_400_000)
  return d.toISOString().slice(0, 10)
}

async function main() {
  console.log('\n=== PROVA REAL — SANDBOX DO ASAAS ===\n')

  if (!API_KEY) {
    console.error('❌ ASAAS_API_KEY ausente. Rode com: node --env-file=.env …\n')
    process.exitCode = 1
    return
  }
  console.log(`Ambiente detectado pelo prefixo da chave: ${SANDBOX ? 'SANDBOX ($aact_hmlg_)' : '⚠️ PRODUÇÃO'}`)
  console.log(`Base: ${BASE}\n`)

  if (!SANDBOX) {
    console.error('❌ A chave NÃO é de sandbox. Abortando por segurança.\n')
    process.exitCode = 1
    return
  }

  // ── PROVA 1 — TESTE DE CONEXÃO (só leitura)
  console.log('[1] Teste de conexão — GET /wallets + GET /myAccount/commercialInfo')
  let walletId = null
  try {
    const w = await asaas('/wallets')
    walletId = w?.data?.[0]?.id ?? null
    checar('credencial aceita pelo sandbox', true)
    checar('walletId retornado', !!walletId, walletId ?? '(nenhum)')
    checar('walletId começa com "ba72bf2f"', String(walletId).startsWith('ba72bf2f'), walletId ?? '—')
    console.log(`     ↳ carteiras na conta: ${w?.data?.length ?? 0}`)
  } catch (e) {
    checar('conexão', false, e.message)
  }

  try {
    const c = await asaas('/myAccount/commercialInfo')
    checar('dados da conta lidos', !!c, `${c?.name ?? '?'}${c?.email ? ` · ${c.email}` : ''}`)
    if (c?.status) console.log(`     ↳ status da conta: ${c.status}`)
  } catch (e) {
    // Não invalida a conexão — /wallets já provou a credencial.
    console.log(`  ⚠️  commercialInfo indisponível (não bloqueia): ${e.message}`)
  }

  // ── PROVA 4 — GUARDA DE ESTOURO (unit-level, sem rede)
  console.log('\n[4] Guarda de estouro do split (sem chamar o Asaas)')
  const wFake = 'ba72bf2f-0000-0000-0000-000000000000'

  // Cobrança de R$ 5,00 no PIX → líquido ≈ 3,01. Comissão de 30% sobre o BRUTO = 1,50 → cabe.
  const ok1 = montarSplitComissao({ walletId: wFake, valorComissao: 1.50, valorCobranca: 5, forma: 'PIX' })
  checar('comissão que cabe é aceita', ok1.ok === true && ok1.split.length === 1,
    ok1.ok ? `fixedValue=${ok1.split[0].fixedValue} (líquido ${liquidoEstimado(5, 'PIX')})` : ok1.erro)

  // Mesma cobrança, comissão de 80% sobre o BRUTO = 4,00 → estoura o líquido de 3,01.
  const ex1 = montarSplitComissao({ walletId: wFake, valorComissao: 4.00, valorCobranca: 5, forma: 'PIX' })
  checar('comissão que estoura é RECUSADA', ex1.ok === false)
  checar('mensagem cita os dois valores',
    !!ex1.erro?.includes('4,00'.replace(',', '.')) && !!ex1.erro?.includes('3.01'), ex1.erro ?? '')
  console.log(`     ↳ "${ex1.erro}"`)

  // Cobrança de R$ 1,00: nem a taxa cabe.
  const ex2 = montarSplitComissao({ walletId: wFake, valorComissao: 0.30, valorCobranca: 1, forma: 'PIX' })
  checar('cobrança menor que a taxa é RECUSADA', ex2.ok === false)
  console.log(`     ↳ "${ex2.erro}"`)

  // Sem wallet não é erro — só não há split.
  const semW = montarSplitComissao({ walletId: null, valorComissao: 1, valorCobranca: 50, forma: 'PIX' })
  checar('sem walletId → sem split, sem erro', semW.ok === true && semW.split.length === 0)

  // Cartão tem taxa percentual: R$ 5,00 → líquido ≈ 4,36.
  checar('líquido do cartão considera o percentual', liquidoEstimado(5, 'CREDIT_CARD') === 4.36,
    String(liquidoEstimado(5, 'CREDIT_CARD')))

  // ── PROVAS 2 e 3 — criam dados (Asaas + banco)
  if (!CRIAR) {
    console.log('\n[2][3] Cliente/cobrança/assinatura: PULADOS (rode com --criar apontando para o branch de DEV)')
  } else {
    console.log('\n[2] Cliente + cobrança de teste')
    const marca = Date.now().toString(36)
    const cli = await asaas('/customers', {
      metodo: 'POST',
      corpo: {
        name: `Ateliê Teste SOA ${marca}`,
        cpfCnpj: '24971563792',              // CPF fictício de teste do sandbox
        email: `teste-${marca}@exemplo.com.br`,
        externalReference: `ws_teste_${marca}`,
      },
    })
    checar('cliente criado', !!cli?.id, cli?.id)

    const cob = await asaas('/payments', {
      metodo: 'POST',
      corpo: {
        customer: cli.id, billingType: 'PIX', value: 5.00, dueDate: amanha(),
        description: 'Cobrança de teste — fundação Asaas',
        externalReference: `teste-sandbox-${marca}`,
      },
    })
    checar('cobrança criada', !!cob?.id, cob?.id)
    checar('valor 5.00', cob?.value === 5, String(cob?.value))
    checar('invoiceUrl retornada', !!cob?.invoiceUrl)
    console.log(`\n     🔗 invoiceUrl: ${cob?.invoiceUrl}\n`)

    console.log('[3] Assinatura de teste (MONTHLY, sem split)')
    const ass = await asaas('/subscriptions', {
      metodo: 'POST',
      corpo: {
        customer: cli.id, billingType: 'PIX', value: 5.00, nextDueDate: amanha(),
        cycle: 'MONTHLY', description: 'Assinatura de teste — fundação Asaas',
        externalReference: `teste-sandbox-${marca}`,
      },
    })
    checar('assinatura criada', !!ass?.id, ass?.id)
    checar('ciclo MONTHLY', ass?.cycle === 'MONTHLY', ass?.cycle)
    checar('status', !!ass?.status, ass?.status)
    console.log('\n  ⚠️  Persistência em AsaasCliente/AsaasCobranca/AsaasAssinatura exige a migração aplicada.')
  }

  console.log(`\n${falhas === 0 ? '✅ TODAS as provas executadas passaram' : `❌ ${falhas} prova(s) falharam`}\n`)
  process.exitCode = falhas === 0 ? 0 : 1
}

main().catch(e => { console.error('\n❌ Erro:', limparSegredo(e.message), '\n'); process.exitCode = 1 })
