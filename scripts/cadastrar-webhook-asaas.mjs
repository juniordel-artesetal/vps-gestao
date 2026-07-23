// ─────────────────────────────────────────────────────────────────────────────
// Cadastra (ou atualiza) o webhook do SOA no SANDBOX do Asaas — via API, sem painel.
//
// USO (a ORDEM dos --env-file importa: o último vence):
//   PREVIEW_URL=https://<preview>.vercel.app \
//   node --env-file=.env --env-file=.env.local scripts/cadastrar-webhook-asaas.mjs
//
//   ...  scripts/cadastrar-webhook-asaas.mjs --listar    # só lista os existentes
//   ...  scripts/cadastrar-webhook-asaas.mjs --remover <id>
//
// .env.local → ASAAS_API_KEY (sandbox), WEBHOOK_TOKEN_PREVIEW (gerado em /master/asaas),
//              VERCEL_BYPASS_SECRET (Protection Bypass for Automation)
//
// 🔒 Nem a API key, nem o authToken, nem o bypass aparecem na saída — a URL é
//    impressa com o secret mascarado.
// ⚠️ SANDBOX apenas: aborta se a chave não tiver o prefixo $aact_hmlg_.
// ─────────────────────────────────────────────────────────────────────────────
const API_KEY = (process.env.ASAAS_API_KEY || '').trim()
const TOKEN = (process.env.WEBHOOK_TOKEN_PREVIEW || '').trim()
const BYPASS = (process.env.VERCEL_BYPASS_SECRET || '').trim()
const PREVIEW = (process.env.PREVIEW_URL || '').replace(/\/+$/, '')

const LISTAR = process.argv.includes('--listar')
const REMOVER = process.argv.includes('--remover') ? process.argv[process.argv.indexOf('--remover') + 1] : null

if (!API_KEY.includes('_hmlg_')) {
  console.error('\n❌ ASAAS_API_KEY não é de sandbox ($aact_hmlg_). Abortando.\n')
  process.exit(1)
}
const BASE = 'https://api-sandbox.asaas.com/v3'

// Eventos de cobrança que a fundação processa (lib/pagamento/asaas/webhook.ts).
const EVENTOS = [
  'PAYMENT_RECEIVED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_OVERDUE',
  'PAYMENT_REFUNDED',
  'PAYMENT_DELETED',
  'PAYMENT_CHARGEBACK_REQUESTED',
]

const mascarar = (s) => String(s)
  .replace(new RegExp(BYPASS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[BYPASS]')
  .replace(/\$aact_[A-Za-z0-9+/=_-]+/g, '[REDACTED]')

async function asaas(caminho, { metodo = 'GET', corpo } = {}) {
  const r = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: { access_token: API_KEY, 'Content-Type': 'application/json', 'User-Agent': 'SOA-VPS-Gestao' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(20_000),
  })
  const t = await r.text()
  let d = null
  try { d = t ? JSON.parse(t) : null } catch {}
  if (!r.ok) {
    const e = d?.errors?.map(x => x.description || x.code).join('; ')
    throw new Error(mascarar(e || `Asaas respondeu ${r.status}`))
  }
  return d
}

const listar = async () => (await asaas('/webhooks?limit=100'))?.data ?? []

async function main() {
  console.log('\n=== Webhook do SOA no sandbox do Asaas ===\n')

  if (REMOVER) {
    await asaas(`/webhooks/${REMOVER}`, { metodo: 'DELETE' })
    console.log(`  🗑️  removido: ${REMOVER}\n`)
    return
  }

  const existentes = await listar()
  console.log(`Webhooks já cadastrados: ${existentes.length}`)
  for (const w of existentes) {
    console.log(`  · ${w.id} — ${w.name} — ${mascarar(w.url)} — ${w.enabled ? 'ativo' : 'inativo'}`)
  }

  if (LISTAR) { console.log(); return }

  if (!PREVIEW || !TOKEN) {
    console.error('\n❌ Faltam PREVIEW_URL e/ou WEBHOOK_TOKEN_PREVIEW.\n')
    process.exitCode = 1
    return
  }

  // O bypass entra na QUERY porque o Asaas só aceita uma URL — não dá para
  // mandar header customizado. Sem ele, a Deployment Protection devolve 401
  // antes da nossa rota e o Asaas nunca chega a ser autenticado pelo authToken.
  const url = `${PREVIEW}/api/webhooks/asaas`
    + (BYPASS ? `?x-vercel-protection-bypass=${BYPASS}` : '')

  const corpo = {
    name: 'SOA — fundação Asaas (preview)',
    url,
    email: process.env.SUPORTE_EMAIL || 'suporte@vps-gestao.com.br',
    enabled: true,
    interrupted: false,
    authToken: TOKEN,          // vira o header asaas-access-token nas entregas
    sendType: 'SEQUENTIALLY',  // ordem preservada; simplifica a reconciliação
    events: EVENTOS,
  }

  // Idempotente: se já existe um apontando para este mesmo preview, atualiza.
  const mesmo = existentes.find(w => (w.url || '').startsWith(`${PREVIEW}/api/webhooks/asaas`))
  const r = mesmo
    ? await asaas(`/webhooks/${mesmo.id}`, { metodo: 'PUT', corpo })
    : await asaas('/webhooks', { metodo: 'POST', corpo })

  console.log(`\n  ${mesmo ? '♻️  atualizado' : '✅ criado'}`)
  console.log(`  id:      ${r?.id}`)
  console.log(`  url:     ${mascarar(r?.url)}`)
  console.log(`  ativo:   ${r?.enabled}`)
  console.log(`  envio:   ${r?.sendType}`)
  console.log(`  eventos: ${(r?.events || []).join(', ')}`)
  console.log(`  authToken configurado: ${r?.authToken ? 'sim' : '(não devolvido pela API)'}\n`)
}

main().catch(e => { console.error('\n❌ Erro:', mascarar(e.message), '\n'); process.exitCode = 1 })
