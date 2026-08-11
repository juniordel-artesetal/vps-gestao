// Conexão do Mercado Livre POR WORKSPACE (OAuth authorization code).
// - Tokens CRIPTOGRAFADOS (encryptToken). O ML ROTACIONA o refresh_token a cada
//   refresh → salvamos sempre o novo.
// - client_id/secret/redirect só em env. Sem credenciais/conexão → tudo devolve
//   estado desconectado (fallback), nunca quebra.
import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { encryptToken, decryptToken } from '@/lib/mercadolivre/cripto'

const AUTH_URL = 'https://auth.mercadolivre.com.br/authorization'
const TOKEN_URL = 'https://api.mercadolibre.com/oauth/token'
const USER_URL = 'https://api.mercadolibre.com/users/me'
const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export function credenciaisConfiguradas(): boolean {
  return !!(process.env.ML_CLIENT_ID && process.env.ML_CLIENT_SECRET && process.env.ML_REDIRECT_URI)
}

let ok = false
export async function ensureMLConexao(): Promise<void> {
  if (ok) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MLConexao" (
      "id"                 TEXT PRIMARY KEY,
      "workspaceId"        TEXT NOT NULL UNIQUE,
      "sellerId"           TEXT,
      "nickname"           TEXT,
      "accessTokenCripto"  TEXT,
      "refreshTokenCripto" TEXT,
      "tokenExpiraEm"      TIMESTAMPTZ,
      "conectado"          BOOLEAN NOT NULL DEFAULT false,
      "conectadoEm"        TIMESTAMPTZ,
      "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  ok = true
}

// ── State assinado carregando o workspaceId (CSRF) ──────────────────────
function segredoState(): string { return process.env.NEXTAUTH_SECRET || process.env.ML_CLIENT_SECRET || 'ml-state' }
export function assinarState(workspaceId: string): string {
  const nonce = crypto.randomBytes(9).toString('base64url')
  const base = `${workspaceId}.${nonce}`
  const sig = crypto.createHmac('sha256', segredoState()).update(base).digest('base64url').slice(0, 24)
  return `${base}.${sig}`
}
export function validarState(state: string | null | undefined): string | null {
  if (!state) return null
  const parts = String(state).split('.')
  if (parts.length !== 3) return null
  const [workspaceId, nonce, sig] = parts
  const esperado = crypto.createHmac('sha256', segredoState()).update(`${workspaceId}.${nonce}`).digest('base64url').slice(0, 24)
  if (sig.length !== esperado.length) return null
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado))) return null
  } catch { return null }
  return workspaceId || null
}

export function urlAutorizacao(state: string): string {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.ML_CLIENT_ID || '',
    redirect_uri: process.env.ML_REDIRECT_URI || '',
    state,
  })
  return `${AUTH_URL}?${p.toString()}`
}

async function persistir(workspaceId: string, tok: { access_token: string; refresh_token?: string; expires_in?: number }, seller?: { id?: string | number; nickname?: string }) {
  await ensureMLConexao()
  const expira = new Date(Date.now() + ((Number(tok.expires_in) || 21600) - 120) * 1000)
  const accEnc = encryptToken(tok.access_token)
  const refEnc = tok.refresh_token ? encryptToken(tok.refresh_token) : null
  const id = gerarId()
  await prisma.$executeRaw`
    INSERT INTO "MLConexao" ("id","workspaceId","sellerId","nickname","accessTokenCripto","refreshTokenCripto","tokenExpiraEm","conectado","conectadoEm","updatedAt")
    VALUES (${id}, ${workspaceId}, ${seller?.id != null ? String(seller.id) : null}, ${seller?.nickname ?? null}, ${accEnc}, ${refEnc}, ${expira}, true, NOW(), NOW())
    ON CONFLICT ("workspaceId") DO UPDATE SET
      "sellerId"           = COALESCE(EXCLUDED."sellerId", "MLConexao"."sellerId"),
      "nickname"           = COALESCE(EXCLUDED."nickname", "MLConexao"."nickname"),
      "accessTokenCripto"  = EXCLUDED."accessTokenCripto",
      "refreshTokenCripto" = COALESCE(EXCLUDED."refreshTokenCripto", "MLConexao"."refreshTokenCripto"),
      "tokenExpiraEm"      = EXCLUDED."tokenExpiraEm",
      "conectado"          = true,
      "conectadoEm"        = COALESCE("MLConexao"."conectadoEm", NOW()),
      "updatedAt"          = NOW()
  `
}

// Troca o code por tokens no callback e guarda (criptografado) + dados do seller.
export async function conectarComCode(workspaceId: string, code: string): Promise<{ ok: boolean; erro?: string }> {
  if (!credenciaisConfiguradas()) return { ok: false, erro: 'Credenciais do Mercado Livre não configuradas.' }
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.ML_CLIENT_ID!,
      client_secret: process.env.ML_CLIENT_SECRET!,
      code,
      redirect_uri: process.env.ML_REDIRECT_URI!,
    })
    const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok || !j.access_token) return { ok: false, erro: j?.message || 'Falha ao obter token do Mercado Livre.' }
    // Dados do seller (id/nickname) — não bloqueia se falhar
    let seller: any = { id: j.user_id }
    try {
      const ur = await fetch(USER_URL, { headers: { authorization: `Bearer ${j.access_token}` } })
      if (ur.ok) { const u = await ur.json(); seller = { id: u.id, nickname: u.nickname } }
    } catch {}
    await persistir(workspaceId, j, seller)
    return { ok: true }
  } catch (e: any) {
    return { ok: false, erro: 'Erro de conexão com o Mercado Livre.' }
  }
}

// Access token válido: renova (refresh rotativo) se estiver perto de expirar. null = não conectado.
export async function getAccessTokenValido(workspaceId: string): Promise<string | null> {
  await ensureMLConexao()
  const [c] = await prisma.$queryRaw`
    SELECT "accessTokenCripto","refreshTokenCripto","tokenExpiraEm","conectado"
    FROM "MLConexao" WHERE "workspaceId" = ${workspaceId}
  ` as { accessTokenCripto: string | null; refreshTokenCripto: string | null; tokenExpiraEm: Date | null; conectado: boolean }[]
  if (!c || !c.conectado) return null

  const agora = Date.now()
  if (c.accessTokenCripto && c.tokenExpiraEm && new Date(c.tokenExpiraEm).getTime() > agora + 60_000) {
    return decryptToken(c.accessTokenCripto)
  }
  // Renova via refresh_token
  const refresh = decryptToken(c.refreshTokenCripto)
  if (!refresh || !credenciaisConfiguradas()) return null
  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.ML_CLIENT_ID!,
      client_secret: process.env.ML_CLIENT_SECRET!,
      refresh_token: refresh,
    })
    const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok || !j.access_token) {
      console.error(`[ML] refresh falhou ws=${workspaceId}: ${j?.message || r.status}`)
      return null
    }
    await persistir(workspaceId, j)   // salva o NOVO refresh_token rotacionado
    return j.access_token as string
  } catch {
    return null
  }
}

export interface StatusML { conectado: boolean; sellerId: string | null; nickname: string | null; expiraEm: string | null; credenciais: boolean }
export async function statusConexao(workspaceId: string): Promise<StatusML> {
  await ensureMLConexao()
  const [c] = await prisma.$queryRaw`
    SELECT "sellerId","nickname","tokenExpiraEm","conectado" FROM "MLConexao" WHERE "workspaceId" = ${workspaceId}
  ` as { sellerId: string | null; nickname: string | null; tokenExpiraEm: Date | null; conectado: boolean }[]
  return {
    conectado: !!c?.conectado,
    sellerId: c?.sellerId ?? null,
    nickname: c?.nickname ?? null,
    expiraEm: c?.tokenExpiraEm ? new Date(c.tokenExpiraEm).toISOString() : null,
    credenciais: credenciaisConfiguradas(),
  }
}

export async function desconectar(workspaceId: string): Promise<void> {
  await ensureMLConexao()
  await prisma.$executeRaw`
    UPDATE "MLConexao" SET "conectado" = false, "accessTokenCripto" = NULL, "refreshTokenCripto" = NULL, "tokenExpiraEm" = NULL, "updatedAt" = NOW()
    WHERE "workspaceId" = ${workspaceId}
  `
}
