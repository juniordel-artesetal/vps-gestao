// Adaptador de LEITURA da API da Hotmart (gestão de assinaturas). Só Master.
// Credenciais SÓ em env do servidor — NUNCA no client, log ou commit:
//   HOTMART_CLIENT_ID, HOTMART_CLIENT_SECRET, (opcional) HOTMART_BASIC
// A API é read-only pra gestão; a troca de plano/valor continua manual no painel Hotmart.
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

const TOKEN_URL = 'https://api-sec-vlc.hotmart.com/security/oauth/token'
const API_BASE  = 'https://developers.hotmart.com/payments/api/v1'

export function credenciaisConfiguradas(): boolean {
  return !!(process.env.HOTMART_CLIENT_ID && process.env.HOTMART_CLIENT_SECRET)
}

// Token em cache no módulo (evita bater no OAuth a cada página). Expira ~antes do prazo.
let cacheToken: { token: string; exp: number } | null = null

async function getAccessToken(): Promise<string> {
  if (!credenciaisConfiguradas()) throw new Error('HOTMART_SEM_CREDENCIAIS')
  if (cacheToken && cacheToken.exp > Date.now()) return cacheToken.token

  const id = process.env.HOTMART_CLIENT_ID!
  const secret = process.env.HOTMART_CLIENT_SECRET!
  const basic = process.env.HOTMART_BASIC || Buffer.from(`${id}:${secret}`).toString('base64')

  const url = `${TOKEN_URL}?grant_type=client_credentials&client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(secret)}`
  const r = await fetch(url, { method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' } })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.access_token) throw new Error('HOTMART_OAUTH_FALHOU')
  cacheToken = { token: j.access_token, exp: Date.now() + (Number(j.expires_in || 3600) - 120) * 1000 }
  return j.access_token
}

// Normaliza uma assinatura da API pro nosso formato (defensivo — nomes de campo variam).
function mapear(it: any) {
  const codigo = String(it.subscriber_code ?? it.subscription_id ?? it.code ?? it.id ?? '')
  const plano = it.plan ?? {}
  const produto = it.product ?? {}
  const preco = it.price ?? it.subscription?.price ?? {}
  const assinante = it.subscriber ?? it.user ?? {}
  const toDate = (v: any) => {
    const n = Number(v)
    if (!v || Number.isNaN(n)) return null
    return new Date(n < 1e12 ? n * 1000 : n) // aceita s ou ms
  }
  return {
    codigo,
    email: (assinante.email ?? '').toString().trim().toLowerCase() || null,
    nomeAssinante: assinante.name ?? assinante.ucode ?? null,
    planoId: (plano.id ?? produto.id ?? null) != null ? String(plano.id ?? produto.id) : null,
    planoNome: plano.name ?? produto.name ?? null,
    status: (it.status ?? '').toString().toUpperCase() || null,
    valor: preco.value != null ? Number(preco.value) : (it.value != null ? Number(it.value) : null),
    moeda: preco.currency_code ?? preco.currency_value ?? 'BRL',
    adesao: toDate(it.accession_date ?? it.date_accession ?? it.request_date),
    proximaCobranca: toDate(it.date_next_charge ?? it.next_charge_date ?? null),
  }
}

export interface AssinaturaHotmart {
  codigo: string; email: string | null; nomeAssinante: string | null
  planoId: string | null; planoNome: string | null; status: string | null
  valor: number | null; moeda: string | null; adesao: Date | null; proximaCobranca: Date | null
}

// Assinaturas de UM e-mail (filtro subscriber_email) — para a campanha de migração.
export async function assinaturasPorEmail(email: string): Promise<AssinaturaHotmart[]> {
  const token = await getAccessToken()
  const qs = new URLSearchParams({ max_results: '20', subscriber_email: String(email).trim().toLowerCase() })
  const r = await fetch(`${API_BASE}/subscriptions?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!r.ok) throw new Error(`HOTMART_API_${r.status}`)
  const j = await r.json().catch(() => ({}))
  const itens: any[] = j.items ?? j.data ?? []
  return itens.map(mapear).filter(a => a.codigo) as AssinaturaHotmart[]
}

// Produto SOA na Hotmart (as assinaturas por e-mail podem misturar outros produtos,
// ex.: "PPZ - Papelaria do Zero"; filtramos por este id).
export const HOTMART_SOA_PRODUCT_ID = 7467295

/** Situação da assinatura do PRODUTO SOA na Hotmart para um e-mail.
 *  'SEM_CRED' quando não há credenciais de API (aí o chamador usa fallback best-effort). */
export async function statusSoaPorEmail(
  email: string,
): Promise<'ATIVA' | 'ATRASO' | 'CANCELADA' | 'SEM_ASSINATURA' | 'SEM_CRED' | 'ERRO'> {
  if (!credenciaisConfiguradas()) return 'SEM_CRED'
  const mail = String(email || '').trim().toLowerCase()
  if (!mail) return 'SEM_ASSINATURA'
  try {
    const token = await getAccessToken()
    const qs = new URLSearchParams({ max_results: '20', subscriber_email: mail })
    const r = await fetch(`${API_BASE}/subscriptions?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    if (!r.ok) return 'ERRO'
    const j = await r.json().catch(() => ({}))
    const sts: string[] = (j.items ?? j.data ?? [])
      .filter((x: any) => Number(x?.product?.id) === HOTMART_SOA_PRODUCT_ID)
      .map((x: any) => String(x?.status ?? '').toUpperCase())
    if (!sts.length) return 'SEM_ASSINATURA'
    if (sts.some(s => s === 'ACTIVE' || s === 'STARTED')) return 'ATIVA'
    if (sts.some(s => s === 'DELAYED' || s === 'OVERDUE')) return 'ATRASO'
    return 'CANCELADA'
  } catch {
    return 'ERRO'
  }
}

export interface SoaHotmart {
  status: 'ATIVA' | 'ATRASO' | 'CANCELADA' | 'SEM_ASSINATURA' | 'SEM_CRED' | 'ERRO'
  ciclo: 'MENSAL' | 'ANUAL' | null
  code: string | null   // subscriber_code — necessário pra cancelar
}

/** Assinatura SOA na Hotmart de um e-mail: status + ciclo (pelo nome do plano) + subscriber_code. */
export async function assinaturaSoaPorEmail(email: string): Promise<SoaHotmart> {
  if (!credenciaisConfiguradas()) return { status: 'SEM_CRED', ciclo: null, code: null }
  const mail = String(email || '').trim().toLowerCase()
  if (!mail) return { status: 'SEM_ASSINATURA', ciclo: null, code: null }
  try {
    const token = await getAccessToken()
    const qs = new URLSearchParams({ max_results: '20', subscriber_email: mail })
    const r = await fetch(`${API_BASE}/subscriptions?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
    if (!r.ok) return { status: 'ERRO', ciclo: null, code: null }
    const j = await r.json().catch(() => ({}))
    const soa: any[] = (j.items ?? j.data ?? []).filter((x: any) => Number(x?.product?.id) === HOTMART_SOA_PRODUCT_ID)
    if (!soa.length) return { status: 'SEM_ASSINATURA', ciclo: null, code: null }
    const st = (x: any) => String(x?.status ?? '').toUpperCase()
    const pick = soa.find(x => ['ACTIVE', 'STARTED'].includes(st(x)))
      || soa.find(x => ['DELAYED', 'OVERDUE'].includes(st(x))) || soa[0]
    const s = st(pick)
    const status = ['ACTIVE', 'STARTED'].includes(s) ? 'ATIVA' : ['DELAYED', 'OVERDUE'].includes(s) ? 'ATRASO' : 'CANCELADA'
    const ciclo = status === 'CANCELADA' ? null : (/ANU|ANO|YEAR/i.test(String(pick?.plan?.name || '')) ? 'ANUAL' : 'MENSAL')
    const code = pick?.subscriber_code || pick?.subscriber?.code || pick?.code || null
    return { status, ciclo, code }
  } catch {
    return { status: 'ERRO', ciclo: null, code: null }
  }
}

/** MIGRAÇÃO PAGA → encerra a Hotmart. Chamado quando um pagamento Asaas é confirmado:
 *  se a artesã ainda tem assinatura SOA ativa/atrasada na Hotmart, cancela pra não haver
 *  double-billing (caso Petit Kraft). Best-effort, idempotente, auditado, NUNCA lança. */
export async function cancelarHotmartMigrado(workspaceId: string): Promise<{ cancelou: boolean; motivo: string }> {
  if (!credenciaisConfiguradas() || !workspaceId) return { cancelou: false, motivo: 'sem_cred_ou_ws' }
  try {
    const [u] = await prisma.$queryRaw`
      SELECT lower("email") AS email FROM "User"
      WHERE "workspaceId" = ${workspaceId} AND "role" = 'ADMIN' AND "ativo" = true
      ORDER BY "createdAt" ASC LIMIT 1
    ` as { email: string }[]
    if (!u?.email) return { cancelou: false, motivo: 'sem_email' }
    const soa = await assinaturaSoaPorEmail(u.email)
    if (soa.status !== 'ATIVA' && soa.status !== 'ATRASO') return { cancelou: false, motivo: `sem_soa_ativa:${soa.status}` }
    if (!soa.code) return { cancelou: false, motivo: 'sem_code' }
    const c = await cancelarAssinatura(soa.code, { enviarEmailHotmart: false })
    try {
      await prisma.$executeRaw`
        INSERT INTO "HotmartCancelamento" ("id","email","subscriberCode","motivo","status","resp","criadoEm")
        VALUES (${crypto.randomBytes(9).toString('hex')}, ${u.email}, ${soa.code}, 'migracao-paga-auto',
                ${c.ok ? 'CANCELADA' : 'ERRO'}, ${JSON.stringify(c.corpo ?? c.erro ?? {}).slice(0, 200)}, NOW())
        ON CONFLICT ("subscriberCode") DO UPDATE SET "status" = EXCLUDED."status", "criadoEm" = NOW()
      `
    } catch { /* tabela pode não existir ainda — auditoria é bônus */ }
    console.log(`[HOTMART-MIGRACAO] ws=${workspaceId} code=${soa.code} ${c.ok ? 'cancelada' : 'falha:' + c.erro}`)
    return { cancelou: c.ok, motivo: c.ok ? 'cancelada' : (c.erro || 'falha_cancel') }
  } catch (e) {
    return { cancelou: false, motivo: (e as Error)?.message || 'erro' }
  }
}

// Cancela UMA assinatura pelo subscriber_code (ação do PRODUTOR via API).
// `enviarEmailHotmart=false` porque o SOA manda o próprio aviso (e explica o Pix
// Automático). Retorna o corpo cru pra diagnóstico — a API pode recusar (ex.: já
// cancelada, ou o produtor sem permissão), e aí o Master cancela no painel.
export async function cancelarAssinatura(
  subscriberCode: string,
  opts?: { enviarEmailHotmart?: boolean },
): Promise<{ ok: boolean; status?: number; corpo?: any; erro?: string }> {
  if (!credenciaisConfiguradas()) return { ok: false, erro: 'HOTMART_SEM_CREDENCIAIS' }
  const code = String(subscriberCode || '').trim()
  if (!code) return { ok: false, erro: 'subscriber_code ausente' }
  try {
    const token = await getAccessToken()
    const r = await fetch(`${API_BASE}/subscriptions/${encodeURIComponent(code)}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ send_email: !!opts?.enviarEmailHotmart }),
    })
    const corpo = await r.json().catch(() => ({}))
    if (!r.ok) return { ok: false, status: r.status, corpo, erro: `HOTMART_CANCEL_${r.status}` }
    return { ok: true, status: r.status, corpo }
  } catch (e) {
    return { ok: false, erro: (e as Error)?.message || 'HOTMART_CANCEL_ERRO' }
  }
}

// Busca TODAS as assinaturas seguindo a paginação (page_token) até o fim.
// onPagina: callback opcional por página (pra fazer upsert incremental e "retomar").
export async function listarAssinaturas(
  onPagina?: (lote: AssinaturaHotmart[], pagina: number) => Promise<void>,
): Promise<{ total: number; paginas: number }> {
  const token = await getAccessToken()
  let pageToken: string | null = null
  let pagina = 0
  let total = 0
  const MAX_PAGINAS = 500 // trava de segurança contra loop infinito

  do {
    const qs = new URLSearchParams({ max_results: '50' })
    if (pageToken) qs.set('page_token', pageToken)
    const r = await fetch(`${API_BASE}/subscriptions?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    if (r.status === 429) { // rate limit — espera e tenta a MESMA página de novo
      await new Promise(res => setTimeout(res, 2000))
      continue
    }
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(`HOTMART_API_${r.status}`)

    const itens: any[] = j.items ?? j.data ?? []
    const lote = itens.map(mapear).filter(a => a.codigo)
    total += lote.length
    pagina++
    if (onPagina) await onPagina(lote as AssinaturaHotmart[], pagina)

    pageToken = j.page_info?.next_page_token ?? j.next_page_token ?? null
  } while (pageToken && pagina < MAX_PAGINAS)

  return { total, paginas: pagina }
}
