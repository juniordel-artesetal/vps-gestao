// Conexão do TikTok Shop POR WORKSPACE (OAuth authorization code) — ETAPA 1.
// Espelha o padrão do Mercado Livre (lib/mercadolivre/conta.ts): tokens CIFRADOS,
// state HMAC carregando o workspaceId (CSRF) e a tabela criada sob demanda.
// Endpoints/hosts vêm do ENV (sandbox × produção mudam), com defaults de produção.
// Só leitura de credenciais do ENV; sem credenciais → estado desconectado (nunca quebra).
import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { encryptToken, decryptToken } from '@/lib/tiktok/cripto'
import { TIKTOK_ENDPOINTS } from '@/lib/tiktok/config'

// Hosts vêm do config central (env-configuráveis; default = produção).
const { servicesBase: SERVICES_BASE, authBase: AUTH_BASE, apiBase: API_BASE } = TIKTOK_ENDPOINTS

const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

/** Gate da feature (esconde tudo do TikTok quando OFF). */
export function integracoesAtivo(): boolean {
  return process.env.INTEGRACOES_ATIVO === 'on'
}

/** Credenciais mínimas para iniciar o OAuth. */
export function credenciaisConfiguradas(): boolean {
  return !!(process.env.TIKTOK_APP_KEY && process.env.TIKTOK_APP_SECRET && process.env.TIKTOK_SERVICE_ID)
}

let tabelaOk = false
export async function ensureTikTokConexao(): Promise<void> {
  if (tabelaOk) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TikTokConexao" (
      "id"                 TEXT PRIMARY KEY,
      "workspaceId"        TEXT NOT NULL UNIQUE,
      "shopId"             TEXT,
      "shopCipher"         TEXT,
      "sellerName"         TEXT,
      "openId"             TEXT,
      "regiao"             TEXT,
      "escopos"            TEXT,
      "accessTokenCripto"  TEXT,
      "refreshTokenCripto" TEXT,
      "tokenExpiraEm"      TIMESTAMPTZ,
      "refreshExpiraEm"    TIMESTAMPTZ,
      "conectado"          BOOLEAN NOT NULL DEFAULT false,
      "conectadoEm"        TIMESTAMPTZ,
      "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  tabelaOk = true
}

// ── State assinado (HMAC) carregando workspaceId + expiração (CSRF) ─────────
function segredoState(): string { return process.env.NEXTAUTH_SECRET || process.env.TIKTOK_APP_SECRET || 'tiktok-state' }

export function assinarState(workspaceId: string): string {
  const exp = Date.now() + 10 * 60 * 1000 // vale 10 min
  const nonce = crypto.randomBytes(9).toString('base64url')
  const base = `${workspaceId}.${exp}.${nonce}`
  const sig = crypto.createHmac('sha256', segredoState()).update(base).digest('base64url').slice(0, 24)
  return `${base}.${sig}`
}

export function validarState(state: string | null | undefined): string | null {
  if (!state) return null
  const parts = String(state).split('.')
  if (parts.length !== 4) return null
  const [workspaceId, exp, nonce, sig] = parts
  const esperado = crypto.createHmac('sha256', segredoState()).update(`${workspaceId}.${exp}.${nonce}`).digest('base64url').slice(0, 24)
  if (sig.length !== esperado.length) return null
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado))) return null
  } catch { return null }
  if (!Number(exp) || Number(exp) < Date.now()) return null // expirado
  return workspaceId || null
}

/** URL de autorização do TikTok (service_id + state). O redirect_uri é o registrado no app. */
export function urlAutorizacao(state: string): string {
  const p = new URLSearchParams({
    service_id: process.env.TIKTOK_SERVICE_ID || '',
    state,
  })
  return `${SERVICES_BASE}/open/authorize?${p.toString()}`
}

// ── Assinatura das chamadas open-api (HMAC-SHA256) ──────────────────────────
// Algoritmo TikTok Shop: app_secret + path + (cada key+value ordenado, exceto
// sign/access_token) + [body] + app_secret → HMAC-SHA256(app_secret) em hex.
export function assinarRequisicao(path: string, params: Record<string, string>, body?: string): string {
  const secret = process.env.TIKTOK_APP_SECRET || ''
  const keys = Object.keys(params).filter(k => k !== 'sign' && k !== 'access_token').sort()
  let base = secret + path
  for (const k of keys) base += k + params[k]
  if (body) base += body
  base += secret
  return crypto.createHmac('sha256', secret).update(base).digest('hex')
}

// expire_in do TikTok costuma vir como epoch (segundos). Aceita também duração.
function paraData(expire: number | undefined, fallbackSeg: number): Date {
  const n = Number(expire) || 0
  if (n > 1_000_000_000) return new Date(n * 1000)            // epoch absoluto
  if (n > 0) return new Date(Date.now() + n * 1000)           // duração em segundos
  return new Date(Date.now() + fallbackSeg * 1000)
}

interface DadosToken {
  access_token: string
  refresh_token?: string
  access_token_expire_in?: number
  refresh_token_expire_in?: number
  open_id?: string
  seller_name?: string
  seller_base_region?: string
  granted_scopes?: string[]
}

async function persistir(workspaceId: string, d: DadosToken, shop?: { id?: string; cipher?: string; name?: string; region?: string }) {
  await ensureTikTokConexao()
  const accEnc = encryptToken(d.access_token)
  const refEnc = d.refresh_token ? encryptToken(d.refresh_token) : null
  const tokenExpira = paraData(d.access_token_expire_in, 6 * 3600)
  const refreshExpira = paraData(d.refresh_token_expire_in, 30 * 24 * 3600)
  const escopos = Array.isArray(d.granted_scopes) ? d.granted_scopes.join(',') : null
  const id = gerarId()
  await prisma.$executeRaw`
    INSERT INTO "TikTokConexao" ("id","workspaceId","shopId","shopCipher","sellerName","openId","regiao","escopos",
                                 "accessTokenCripto","refreshTokenCripto","tokenExpiraEm","refreshExpiraEm","conectado","conectadoEm","updatedAt")
    VALUES (${id}, ${workspaceId}, ${shop?.id ?? null}, ${shop?.cipher ?? null}, ${shop?.name ?? d.seller_name ?? null},
            ${d.open_id ?? null}, ${shop?.region ?? d.seller_base_region ?? null}, ${escopos},
            ${accEnc}, ${refEnc}, ${tokenExpira}, ${refreshExpira}, true, NOW(), NOW())
    ON CONFLICT ("workspaceId") DO UPDATE SET
      "shopId"             = COALESCE(EXCLUDED."shopId", "TikTokConexao"."shopId"),
      "shopCipher"         = COALESCE(EXCLUDED."shopCipher", "TikTokConexao"."shopCipher"),
      "sellerName"         = COALESCE(EXCLUDED."sellerName", "TikTokConexao"."sellerName"),
      "openId"             = COALESCE(EXCLUDED."openId", "TikTokConexao"."openId"),
      "regiao"             = COALESCE(EXCLUDED."regiao", "TikTokConexao"."regiao"),
      "escopos"            = COALESCE(EXCLUDED."escopos", "TikTokConexao"."escopos"),
      "accessTokenCripto"  = EXCLUDED."accessTokenCripto",
      "refreshTokenCripto" = COALESCE(EXCLUDED."refreshTokenCripto", "TikTokConexao"."refreshTokenCripto"),
      "tokenExpiraEm"      = EXCLUDED."tokenExpiraEm",
      "refreshExpiraEm"    = EXCLUDED."refreshExpiraEm",
      "conectado"          = true,
      "conectadoEm"        = COALESCE("TikTokConexao"."conectadoEm", NOW()),
      "updatedAt"          = NOW()
  `
}

/** Busca a 1ª loja autorizada (shop_id + cipher) — best-effort, não bloqueia a conexão. */
async function buscarLoja(accessToken: string): Promise<{ id?: string; cipher?: string; name?: string; region?: string } | null> {
  try {
    const path = '/authorization/202309/shops'
    const params: Record<string, string> = {
      app_key: process.env.TIKTOK_APP_KEY || '',
      timestamp: String(Math.floor(Date.now() / 1000)),
    }
    params.sign = assinarRequisicao(path, params)
    const url = `${API_BASE}${path}?${new URLSearchParams(params).toString()}`
    const r = await fetch(url, { headers: { 'x-tts-access-token': accessToken, 'content-type': 'application/json' } })
    const j: any = await r.json().catch(() => ({}))
    const shop = j?.data?.shops?.[0]
    if (!shop) return null
    return { id: shop.id != null ? String(shop.id) : undefined, cipher: shop.cipher, name: shop.name, region: shop.region }
  } catch {
    return null
  }
}

/** Troca o auth_code por tokens (token/get) e persiste cifrado + loja. */
export async function conectarComCode(workspaceId: string, code: string): Promise<{ ok: boolean; erro?: string }> {
  if (!credenciaisConfiguradas()) return { ok: false, erro: 'Credenciais do TikTok não configuradas.' }
  try {
    const p = new URLSearchParams({
      app_key: process.env.TIKTOK_APP_KEY!,
      app_secret: process.env.TIKTOK_APP_SECRET!,
      auth_code: code,
      grant_type: 'authorized_code',
    })
    const r = await fetch(`${AUTH_BASE}/api/v2/token/get?${p.toString()}`, { headers: { 'content-type': 'application/json' } })
    const j: any = await r.json().catch(() => ({}))
    const d: DadosToken | undefined = j?.data
    if (!r.ok || j?.code !== 0 || !d?.access_token) {
      console.error(`[TIKTOK] token/get falhou ws=${workspaceId}: code=${j?.code} msg=${j?.message || r.status}`)
      return { ok: false, erro: j?.message || 'Falha ao obter token do TikTok.' }
    }
    const loja = await buscarLoja(d.access_token) // best-effort
    await persistir(workspaceId, d, loja ?? undefined)
    return { ok: true }
  } catch (e) {
    console.error(`[TIKTOK] erro conectarComCode ws=${workspaceId}:`, (e as Error)?.message)
    return { ok: false, erro: 'Erro de conexão com o TikTok.' }
  }
}

/** Access token válido (renova via refresh se perto de expirar). null = não conectado. */
export async function getAccessTokenValido(workspaceId: string): Promise<string | null> {
  await ensureTikTokConexao()
  const [c] = await prisma.$queryRaw`
    SELECT "accessTokenCripto","refreshTokenCripto","tokenExpiraEm","conectado"
    FROM "TikTokConexao" WHERE "workspaceId" = ${workspaceId}
  ` as { accessTokenCripto: string | null; refreshTokenCripto: string | null; tokenExpiraEm: Date | null; conectado: boolean }[]
  if (!c || !c.conectado) return null

  if (c.accessTokenCripto && c.tokenExpiraEm && new Date(c.tokenExpiraEm).getTime() > Date.now() + 60_000) {
    return decryptToken(c.accessTokenCripto)
  }
  const refresh = decryptToken(c.refreshTokenCripto)
  if (!refresh || !credenciaisConfiguradas()) return null
  try {
    const p = new URLSearchParams({
      app_key: process.env.TIKTOK_APP_KEY!,
      app_secret: process.env.TIKTOK_APP_SECRET!,
      refresh_token: refresh,
      grant_type: 'refresh_token',
    })
    const r = await fetch(`${AUTH_BASE}/api/v2/token/refresh?${p.toString()}`, { headers: { 'content-type': 'application/json' } })
    const j: any = await r.json().catch(() => ({}))
    const d: DadosToken | undefined = j?.data
    if (!r.ok || j?.code !== 0 || !d?.access_token) {
      console.error(`[TIKTOK] refresh falhou ws=${workspaceId}: ${j?.message || r.status}`)
      return null
    }
    await persistir(workspaceId, d) // salva o novo par de tokens
    return d.access_token
  } catch {
    return null
  }
}

export interface StatusTikTok {
  conectado: boolean
  sellerName: string | null
  shopId: string | null
  regiao: string | null
  expiraEm: string | null
  credenciais: boolean
}

export async function statusConexao(workspaceId: string): Promise<StatusTikTok> {
  await ensureTikTokConexao()
  const [c] = await prisma.$queryRaw`
    SELECT "sellerName","shopId","regiao","tokenExpiraEm","conectado" FROM "TikTokConexao" WHERE "workspaceId" = ${workspaceId}
  ` as { sellerName: string | null; shopId: string | null; regiao: string | null; tokenExpiraEm: Date | null; conectado: boolean }[]
  return {
    conectado: !!c?.conectado,
    sellerName: c?.sellerName ?? null,
    shopId: c?.shopId ?? null,
    regiao: c?.regiao ?? null,
    expiraEm: c?.tokenExpiraEm ? new Date(c.tokenExpiraEm).toISOString() : null,
    credenciais: credenciaisConfiguradas(),
  }
}

export async function desconectar(workspaceId: string): Promise<void> {
  await ensureTikTokConexao()
  await prisma.$executeRaw`
    UPDATE "TikTokConexao"
    SET "conectado" = false, "accessTokenCripto" = NULL, "refreshTokenCripto" = NULL,
        "shopCipher" = NULL, "tokenExpiraEm" = NULL, "refreshExpiraEm" = NULL, "updatedAt" = NOW()
    WHERE "workspaceId" = ${workspaceId}
  `
}
