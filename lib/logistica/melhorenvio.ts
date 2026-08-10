// Adaptador Melhor Envio (fonte: transportadora). OAuth por workspace, cotação,
// compra/geração de etiqueta e rastreio. SANDBOX por padrão (base URL via ENV).
// Endpoints v2 confirmados no ticket: /oauth/authorize, /oauth/token,
// /api/v2/me/shipment/calculate, /api/v2/me/cart, /shipment/checkout,
// /shipment/generate, /shipment/print, /shipment/tracking.
// Token ~30d / refresh ~45d. User-Agent OBRIGATÓRIO. Tokens nunca vão ao client/log.
import { encryptToken, decryptToken } from './cripto'
import { getTokensInternos, salvarTokens } from './config'
import { CotacaoOpcao, EnderecoLog, Pacote, ResultadoEtiqueta, ResultadoImpressao, ResultadoRastreio } from './tipos'

const SCOPES = [
  'shipping-calculate', 'cart-read', 'cart-write',
  'shipping-checkout', 'shipping-generate', 'shipping-print', 'shipping-tracking',
].join(' ')

function baseUrl() {
  return (process.env.MELHORENVIO_BASE_URL || 'https://sandbox.melhorenvio.com.br').replace(/\/$/, '')
}
function userAgent() {
  return process.env.MELHORENVIO_USER_AGENT || 'SOA (suporte@vps-gestao.com.br)'
}
export function credenciaisConfiguradas(): boolean {
  return !!(process.env.MELHORENVIO_CLIENT_ID && process.env.MELHORENVIO_CLIENT_SECRET && process.env.MELHORENVIO_REDIRECT_URI)
}

// ── OAuth ────────────────────────────────────────────────────────────────
export function authorizeUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.MELHORENVIO_CLIENT_ID || '',
    redirect_uri: process.env.MELHORENVIO_REDIRECT_URI || '',
    response_type: 'code',
    scope: SCOPES,
    state,
  })
  return `${baseUrl()}/oauth/authorize?${p.toString()}`
}

async function tokenRequest(body: Record<string, string>): Promise<{
  access_token: string; refresh_token: string; expires_in: number
} | null> {
  const res = await fetch(`${baseUrl()}/oauth/token`, {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'User-Agent': userAgent() },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    console.error('[MELHORENVIO] token request falhou:', res.status)
    return null
  }
  return res.json()
}

// Troca o code do callback por tokens e persiste (criptografado).
export async function trocarCodePorTokens(workspaceId: string, code: string): Promise<boolean> {
  const tok = await tokenRequest({
    grant_type: 'authorization_code',
    client_id: process.env.MELHORENVIO_CLIENT_ID || '',
    client_secret: process.env.MELHORENVIO_CLIENT_SECRET || '',
    redirect_uri: process.env.MELHORENVIO_REDIRECT_URI || '',
    code,
  })
  if (!tok?.access_token) return false
  await persistir(workspaceId, tok)
  return true
}

async function persistir(workspaceId: string, tok: { access_token: string; refresh_token: string; expires_in: number }) {
  const expira = new Date(Date.now() + (Number(tok.expires_in) || 2592000) * 1000)
  await salvarTokens(workspaceId, {
    accessTokenCripto: encryptToken(tok.access_token),
    refreshTokenCripto: encryptToken(tok.refresh_token),
    tokenExpiraEm: expira,
  })
}

// Retorna um access token válido, renovando ANTES de expirar (margem de 2 dias).
// null = não conectado / precisa reconectar. NUNCA loga o token.
export async function getAccessTokenValido(workspaceId: string): Promise<string | null> {
  const cfg = await getTokensInternos(workspaceId)
  if (!cfg || cfg.provedor !== 'melhorenvio' || !cfg.accessTokenCripto) return null

  const expira = cfg.tokenExpiraEm ? new Date(cfg.tokenExpiraEm).getTime() : 0
  const margem = 2 * 24 * 60 * 60 * 1000
  const precisaRenovar = !expira || (expira - Date.now()) < margem

  if (precisaRenovar && cfg.refreshTokenCripto) {
    const refresh = decryptToken(cfg.refreshTokenCripto)
    if (refresh) {
      const tok = await tokenRequest({
        grant_type: 'refresh_token',
        client_id: process.env.MELHORENVIO_CLIENT_ID || '',
        client_secret: process.env.MELHORENVIO_CLIENT_SECRET || '',
        refresh_token: refresh,
        scope: SCOPES,
      })
      if (tok?.access_token) {
        await persistir(workspaceId, tok)
        return tok.access_token
      }
      // refresh falhou mas o access ainda pode estar válido — cai pro atual
    }
  }
  return decryptToken(cfg.accessTokenCripto)
}

// ── Chamada autenticada ──────────────────────────────────────────────────
async function meFetch(access: string, path: string, method: 'GET' | 'POST', body?: any) {
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${access}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': userAgent(),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const txt = await res.text()
  let json: any = null
  try { json = txt ? JSON.parse(txt) : null } catch { json = null }
  return { ok: res.ok, status: res.status, json }
}

function produtosPacote(pacotes: Pacote[]) {
  return pacotes.map((p, i) => ({
    id: String(i + 1),
    width: Math.max(1, Math.round(p.largura || 11)),
    height: Math.max(1, Math.round(p.altura || 2)),
    length: Math.max(1, Math.round(p.comprimento || 16)),
    weight: Math.max(0.05, Number(p.peso) || 0.3),
    insurance_value: Number(p.valorSegurado) || 0,
    quantity: Math.max(1, Number(p.quantidade) || 1),
  }))
}

// ── Cotação ──────────────────────────────────────────────────────────────
export async function cotar(access: string, cepOrigem: string, cepDestino: string, pacotes: Pacote[]): Promise<CotacaoOpcao[]> {
  const { ok, json } = await meFetch(access, '/api/v2/me/shipment/calculate', 'POST', {
    from: { postal_code: cepOrigem.replace(/\D/g, '') },
    to: { postal_code: cepDestino.replace(/\D/g, '') },
    products: produtosPacote(pacotes),
    options: { receipt: false, own_hand: false },
    services: '',
  })
  if (!ok || !Array.isArray(json)) return []
  return json.map((s: any) => ({
    provedor: 'melhorenvio',
    servicoId: String(s.id),
    transportadora: s.company?.name || '',
    servico: s.name || '',
    preco: s.price != null ? Number(s.price) : (s.custom_price != null ? Number(s.custom_price) : 0),
    prazoDias: s.delivery_time != null ? Number(s.delivery_time) : null,
    erro: s.error || null,
  }))
}

// ── Compra + geração de etiqueta ───────────────────────────────────────────
export async function comprarEtiqueta(access: string, p: {
  servicoId: string
  remetente: EnderecoLog
  destinatario: EnderecoLog
  pacote: Pacote
  produtos: { nome: string; quantidade: number; valorUnitario: number }[]
}): Promise<ResultadoEtiqueta> {
  // 1) Carrinho
  const cart = await meFetch(access, '/api/v2/me/cart', 'POST', {
    service: p.servicoId,
    from: enderecoME(p.remetente),
    to: enderecoME(p.destinatario),
    products: p.produtos.map(x => ({ name: x.nome, quantity: x.quantidade, unitary_value: x.valorUnitario })),
    volumes: [{
      height: Math.max(1, Math.round(p.pacote.altura || 2)),
      width: Math.max(1, Math.round(p.pacote.largura || 11)),
      length: Math.max(1, Math.round(p.pacote.comprimento || 16)),
      weight: Math.max(0.05, Number(p.pacote.peso) || 0.3),
    }],
    options: { insurance_value: Number(p.pacote.valorSegurado) || 0, receipt: false, own_hand: false, reverse: false, non_commercial: true },
  })
  const cartId = cart.json?.id
  if (!cart.ok || !cartId) return { ok: false, erro: cart.json?.message || 'Falha ao adicionar ao carrinho' }

  // 2) Checkout (paga com saldo da conta Melhor Envio da artesã)
  const checkout = await meFetch(access, '/api/v2/me/shipment/checkout', 'POST', { orders: [cartId] })
  if (!checkout.ok) return { ok: false, provedorEnvioId: cartId, erro: checkout.json?.message || 'Falha no checkout (verifique saldo)' }

  // 3) Gerar etiqueta
  const gerar = await meFetch(access, '/api/v2/me/shipment/generate', 'POST', { orders: [cartId] })
  if (!gerar.ok) return { ok: false, provedorEnvioId: cartId, status: 'comprado', erro: gerar.json?.message || 'Falha ao gerar etiqueta' }

  // 4) URL de impressão + rastreio (best-effort)
  const url = await imprimirPorId(access, cartId)
  const rast = await rastrearPorId(access, cartId)
  return {
    ok: true,
    provedorEnvioId: cartId,
    etiquetaUrl: url.url || null,
    rastreio: rast.rastreio || null,
    status: 'gerado',
  }
}

// ── Impressão / rastreio por id do provedor ────────────────────────────────
export async function imprimirPorId(access: string, provedorEnvioId: string): Promise<ResultadoImpressao> {
  const { ok, json } = await meFetch(access, '/api/v2/me/shipment/print', 'POST', { mode: 'private', orders: [provedorEnvioId] })
  if (!ok || !json?.url) return { ok: false, erro: json?.message || 'Etiqueta ainda não disponível' }
  return { ok: true, url: json.url }
}

export async function rastrearPorId(access: string, provedorEnvioId: string): Promise<ResultadoRastreio> {
  const { ok, json } = await meFetch(access, '/api/v2/me/shipment/tracking', 'POST', { orders: [provedorEnvioId] })
  if (!ok || !json) return { ok: false, erro: 'Rastreio indisponível' }
  const info = json[provedorEnvioId] || Object.values(json)[0] as any
  return { ok: true, rastreio: info?.tracking || null, status: info?.status || null, eventos: info?.tracking_events || [] }
}

function enderecoME(e: EnderecoLog) {
  return {
    name: e.nome || '',
    document: (e.documento || '').replace(/\D/g, '') || undefined,
    address: e.logradouro || '',
    number: e.numero || 'S/N',
    district: e.bairro || '',
    city: e.cidade || '',
    state_abbr: (e.uf || '').toUpperCase(),
    postal_code: (e.cep || '').replace(/\D/g, ''),
  }
}
