// ─────────────────────────────────────────────────────────────────────────────
// INVESTIGAÇÃO empírica no SANDBOX — evidência de API, não leitura de doc.
//
//   (A) Que carteira o Asaas aceita num split? A de outra conta sandbox foi
//       recusada como "inexistente". Subconta criada por nós funciona?
//   (B) OPÇÃO D — tokenização de cartão: dá para cobrar um parcelamento novo
//       com o token salvo, sem a artesã digitar o cartão de novo?
//
// USO:
//   node --env-file=.env --env-file=.env.local scripts/investigar-split-e-token.mjs
//
// ⚠️ SANDBOX apenas (aborta sem prefixo $aact_hmlg_). Cria subconta e cliente
//    fictícios; nada de produção, nada de dinheiro real.
// ─────────────────────────────────────────────────────────────────────────────
const API_KEY = (process.env.ASAAS_API_KEY || '').trim()
if (!API_KEY.includes('_hmlg_')) { console.error('\n❌ chave não é sandbox\n'); process.exit(1) }
const BASE = 'https://api-sandbox.asaas.com/v3'
const marca = Date.now().toString(36)

async function api(caminho, { metodo = 'GET', corpo, chave = API_KEY } = {}) {
  const r = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: { access_token: chave, 'Content-Type': 'application/json', 'User-Agent': 'SOA-VPS-Gestao' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(30_000),
  })
  const t = await r.text()
  let d = null; try { d = t ? JSON.parse(t) : null } catch {}
  return { status: r.status, ok: r.ok, dados: d, cru: t.slice(0, 200) }
}
const erroDe = (r) => (r.dados?.errors ?? []).map(e => e.description || e.code).join('; ') || `HTTP ${r.status}`

/** CPF fictício com dígitos verificadores válidos — o sandbox exige CPF único por conta. */
function cpfFicticio() {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  for (const pos of [10, 11]) {
    const soma = base.reduce((s, d, i) => s + d * (pos - i), 0)
    let dv = (soma * 10) % 11
    base.push(dv === 10 ? 0 : dv)
  }
  return base.join('')
}

console.log('\n════════ (A) QUE CARTEIRA O ASAAS ACEITA NUM SPLIT? ════════\n')

// A1 — a nossa própria
const minhas = await api('/wallets')
const minhaWallet = minhas.dados?.data?.[0]?.id
console.log(`A1. Carteira da nossa conta: ${minhaWallet}`)

// A2 — criar SUBCONTA e usar a carteira dela
console.log('\nA2. Criando subconta (o caminho documentado para ter walletId de terceiro)')
const sub = await api('/accounts', {
  metodo: 'POST',
  corpo: {
    name: `Influencer Teste ${marca}`,
    email: `influencer.${marca}@teste-soa.local`,
    cpfCnpj: cpfFicticio(),
    birthDate: '1990-05-15',
    mobilePhone: '11987654321',
    address: 'Rua Teste', addressNumber: '100', province: 'Centro',
    postalCode: '01310100', incomeValue: 5000,
    companyType: null,
  },
})
if (!sub.ok) {
  console.log(`   ❌ não criou: ${erroDe(sub)}`)
} else {
  console.log(`   ✅ subconta: id=${sub.dados?.id}`)
  console.log(`      walletId=${sub.dados?.walletId}`)
  console.log(`      apiKey devolvida? ${sub.dados?.apiKey ? 'sim' : 'não'}`)
}
const walletSub = sub.dados?.walletId

// A3 — testar split real com a carteira da subconta
if (walletSub) {
  console.log('\nA3. Assinatura de teste com split para a carteira da SUBCONTA')
  const cli = await api('/customers', { metodo: 'POST', corpo: {
    name: `Cliente Split ${marca}`, cpfCnpj: '24971563792', email: `cs.${marca}@teste-soa.local` } })
  const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const a = await api('/subscriptions', { metodo: 'POST', corpo: {
    customer: cli.dados?.id, billingType: 'CREDIT_CARD', value: 240.40,
    nextDueDate: amanha, cycle: 'YEARLY', description: 'Teste split subconta',
    split: [{ walletId: walletSub, fixedValue: 96.16 }] } })
  if (a.ok) {
    console.log(`   ✅ SPLIT ACEITO — assinatura ${a.dados?.id}`)
    const pg = await api(`/subscriptions/${a.dados.id}/payments`)
    const c = pg.dados?.data?.[0]
    console.log(`      cobrança ${c?.id} R$${c?.value} venc=${c?.dueDate}`)
    console.log(`      🔗 ${c?.invoiceUrl}`)
  } else {
    console.log(`   ❌ recusado: ${erroDe(a)}`)
  }
}

console.log('\n\n════════ (B) OPÇÃO D — TOKENIZAÇÃO DE CARTÃO ════════\n')

const cliTok = await api('/customers', { metodo: 'POST', corpo: {
  name: `Cliente Token ${marca}`, cpfCnpj: '24971563792', email: `ct.${marca}@teste-soa.local`,
  mobilePhone: '11987654321', postalCode: '01310100', address: 'Rua Teste', addressNumber: '100' } })
console.log(`B1. Cliente de teste: ${cliTok.dados?.id}`)

console.log('\nB2. POST /v3/creditCard/tokenizeCreditCard')
const tok = await api('/creditCard/tokenizeCreditCard', { metodo: 'POST', corpo: {
  customer: cliTok.dados?.id,
  creditCard: { holderName: 'TESTE SANDBOX', number: '5162306219378829',
                expiryMonth: '12', expiryYear: '2028', ccv: '318' },
  creditCardHolderInfo: { name: 'Teste Sandbox', email: `ct.${marca}@teste-soa.local`,
    cpfCnpj: '24971563792', postalCode: '01310100', addressNumber: '100',
    phone: '1133334444', mobilePhone: '11987654321' },
  remoteIp: '187.1.1.1',
} })
if (!tok.ok) {
  console.log(`   ❌ NÃO funcionou: ${erroDe(tok)}`)
  console.log(`   → a Opção D depende de liberação; ver relatório`)
} else {
  console.log(`   ✅ tokenizou. Campos devolvidos:`)
  for (const [k, v] of Object.entries(tok.dados ?? {})) console.log(`      ${k}: ${v}`)
}
const token = tok.dados?.creditCardToken

console.log('\nB3. Parcelamento 12x cobrando o TOKEN (sem redigitar o cartão) — SEM split')
const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
let parcOk = false
if (!token) {
  console.log('   ↷ pulado (sem token)')
} else {
  const parc = await api('/payments', { metodo: 'POST', corpo: {
    customer: cliTok.dados?.id, billingType: 'CREDIT_CARD',
    installmentCount: 12, totalValue: 287.88, dueDate: amanha,
    description: 'Teste anual 12x tokenizado',
    creditCardToken: token, remoteIp: '187.1.1.1',
  } })
  if (parc.ok) {
    parcOk = true
    console.log(`   ✅ PARCELAMENTO CRIADO SEM REDIGITAR O CARTÃO`)
    console.log(`      pagamento=${parc.dados?.id} status=${parc.dados?.status}`)
    console.log(`      installment=${parc.dados?.installment} parcela=R$${parc.dados?.value} de 12`)
    console.log(`      cartão: ****${parc.dados?.creditCard?.creditCardNumber} ${parc.dados?.creditCard?.creditCardBrand}`)
    console.log(`      token devolvido de novo? ${parc.dados?.creditCard?.creditCardToken ? 'sim' : 'não'}`)
  } else {
    console.log(`   ❌ recusado: ${erroDe(parc)}`)
  }
}

console.log('\nB4. Parcelamento 12x tokenizado COM split para a subconta')
if (!token || !walletSub) {
  console.log('   ↷ pulado (falta token ou walletId de subconta)')
} else {
  const parc2 = await api('/payments', { metodo: 'POST', corpo: {
    customer: cliTok.dados?.id, billingType: 'CREDIT_CARD',
    installmentCount: 12, totalValue: 287.88, dueDate: amanha,
    description: 'Teste anual 12x tokenizado + split',
    creditCardToken: token, remoteIp: '187.1.1.1',
    split: [{ walletId: walletSub, totalFixedValue: 96.16 }],
  } })
  if (parc2.ok) {
    console.log(`   ✅ SPLIT EM PARCELAMENTO ACEITO — pagamento ${parc2.dados?.id}`)
    console.log(`      totalFixedValue 96,16 distribuído em 12 parcelas (~R$ 8,01 cada)`)
  } else {
    console.log(`   ❌ recusado: ${erroDe(parc2)}`)
  }
}

console.log('\n')
