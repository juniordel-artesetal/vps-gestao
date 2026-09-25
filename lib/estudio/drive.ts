// SOA Edition — Google Drive DA PRÓPRIA ARTESÃ (por login). Nada a ver com lib/googledrive,
// que é o Drive da PLATAFORMA (conta do dono, vídeos do suporte) e nunca deve receber arte de cliente.
//
// • Escopo mínimo: drive.file — o SOA só enxerga os arquivos que ELE criou na conta dela.
// • Tokens cifrados em repouso (AES-256-GCM, chave INTEGRACOES_TOKEN_KEY — a mesma do cofre das
//   integrações; NUNCA rotacionar). Nunca vão para o cliente nem para log.
// • Upload grande (original de ~500 MB) não passa pela função da Vercel (limite ~4,5 MB): o servidor
//   abre uma sessão RESUMABLE com o token dela e o navegador envia direto ao Google. Se o navegador
//   não conseguir (CORS), cai para pedaços de 4 MB via /api/estudio/drive/pedaco.
import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { encryptToken, decryptToken } from '@/lib/tiktok/cripto'
import { ensureEstudioSchema } from './schema'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const PASTA = 'SOA Edition'
const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export function driveConfigurado(): boolean {
  return !!(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.INTEGRACOES_TOKEN_KEY)
}

/** URL de retorno do OAuth — tem de estar cadastrada no cliente OAuth do Google Cloud. Fixa por
 *  ambiente (ESTUDIO_DRIVE_REDIRECT_URI › NEXTAUTH_URL) para não depender do domínio de acesso. */
export function redirectUri(origin: string): string {
  if (process.env.ESTUDIO_DRIVE_REDIRECT_URI) return process.env.ESTUDIO_DRIVE_REDIRECT_URI
  const base = (process.env.NEXTAUTH_URL || origin).replace(/\/+$/, '')
  return `${base}/api/estudio/drive/callback`
}

// ── state anti-CSRF: assinado (HMAC) + amarrado ao login + nonce também em cookie httpOnly ──
const segredoState = () => process.env.NEXTAUTH_SECRET || process.env.INTEGRACOES_TOKEN_KEY || ''
export function criarState(userId: string): { state: string; nonce: string } {
  const nonce = crypto.randomBytes(16).toString('hex')
  const corpo = Buffer.from(JSON.stringify({ u: userId, n: nonce, e: Date.now() + 10 * 60_000 })).toString('base64url')
  const sig = crypto.createHmac('sha256', segredoState()).update(corpo).digest('base64url')
  return { state: `${corpo}.${sig}`, nonce }
}
export function validarState(state: string | null, userId: string, nonceCookie: string | undefined): boolean {
  if (!state || !nonceCookie || !state.includes('.')) return false
  const [corpo, sig] = state.split('.')
  const esperado = crypto.createHmac('sha256', segredoState()).update(corpo).digest('base64url')
  if (sig.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado))) return false
  try {
    const d = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8'))
    return d.u === userId && d.n === nonceCookie && Number(d.e) > Date.now()
  } catch { return false }
}

export function urlAutorizacao(state: string, origin: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!, redirect_uri: redirectUri(origin), response_type: 'code',
    scope: SCOPE, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state,
  })
  return `${AUTH_URL}?${p.toString()}`
}

interface Tokens { r: string | null; a: string; x: number }

async function salvarTokens(workspaceId: string, userId: string, t: Tokens, email: string | null) {
  const cifrado = encryptToken(JSON.stringify(t))
  if (!cifrado) throw new Error('Cofre de tokens indisponível')
  await prisma.$executeRawUnsafe(
    `INSERT INTO "EstudioDriveConta" ("id","workspaceId","userId","tokensCifrados","email") VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT ("userId") DO UPDATE SET "tokensCifrados"=EXCLUDED."tokensCifrados", "workspaceId"=EXCLUDED."workspaceId",
       "email"=COALESCE(EXCLUDED."email","EstudioDriveConta"."email")`,
    gid(), workspaceId, userId, cifrado, email)
}

/** Troca o code pelos tokens e guarda cifrado. Nunca loga code/token. */
export async function conectar(workspaceId: string, userId: string, code: string, origin: string): Promise<{ ok: boolean; erro?: string }> {
  await ensureEstudioSchema()
  const r = await fetch(TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!, client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
      redirect_uri: redirectUri(origin), grant_type: 'authorization_code',
    }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.access_token) return { ok: false, erro: 'token' }
  // Reconsentimento pode não trazer refresh: preserva o anterior.
  let refresh: string | null = j.refresh_token || null
  if (!refresh) refresh = (await lerTokens(userId))?.r ?? null
  let email: string | null = null
  try {
    const a = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', { headers: { Authorization: `Bearer ${j.access_token}` } })
    if (a.ok) email = (await a.json()).user?.emailAddress ?? null
  } catch { /* e-mail é só para exibir */ }
  await salvarTokens(workspaceId, userId, { r: refresh, a: j.access_token, x: Date.now() + (Number(j.expires_in || 3600) - 60) * 1000 }, email)
  return { ok: true }
}

async function lerTokens(userId: string): Promise<Tokens | null> {
  const [row] = await prisma.$queryRawUnsafe<{ t: string }[]>(`SELECT "tokensCifrados" AS t FROM "EstudioDriveConta" WHERE "userId"=$1`, userId)
  const plano = decryptToken(row?.t)
  if (!plano) return null
  try { return JSON.parse(plano) as Tokens } catch { return null }
}

export async function statusDrive(userId: string): Promise<{ configurado: boolean; conectado: boolean; email: string | null }> {
  await ensureEstudioSchema()
  const [row] = await prisma.$queryRawUnsafe<{ email: string | null }[]>(`SELECT "email" FROM "EstudioDriveConta" WHERE "userId"=$1`, userId)
  return { configurado: driveConfigurado(), conectado: !!row, email: row?.email ?? null }
}

/** Access token válido do login (renova pelo refresh). null = precisa reconectar. */
async function accessToken(workspaceId: string, userId: string): Promise<string | null> {
  const t = await lerTokens(userId)
  if (!t) return null
  if (t.a && t.x > Date.now()) return t.a
  if (!t.r) return null
  const r = await fetch(TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!, client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
      refresh_token: t.r, grant_type: 'refresh_token',
    }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.access_token) return null
  await salvarTokens(workspaceId, userId, { r: t.r, a: j.access_token, x: Date.now() + (Number(j.expires_in || 3600) - 60) * 1000 }, null)
  return j.access_token
}

/** Desconecta: revoga no Google (melhor esforço) e APAGA os tokens do banco. */
export async function desconectar(userId: string): Promise<void> {
  const t = await lerTokens(userId)
  const revogar = t?.r || t?.a
  if (revogar) {
    try { await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(revogar)}`, { method: 'POST' }) } catch { /* segue apagando */ }
  }
  await prisma.$executeRawUnsafe(`DELETE FROM "EstudioDriveConta" WHERE "userId"=$1`, userId)
}

async function pastaDoSoa(access: string, userId: string): Promise<string> {
  const [row] = await prisma.$queryRawUnsafe<{ p: string | null }[]>(`SELECT "pastaId" AS p FROM "EstudioDriveConta" WHERE "userId"=$1`, userId)
  if (row?.p) {
    const ok = await fetch(`https://www.googleapis.com/drive/v3/files/${row.p}?fields=id,trashed`, { headers: { Authorization: `Bearer ${access}` } })
    if (ok.ok && !(await ok.json()).trashed) return row.p
  }
  const c = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST', headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: PASTA, mimeType: 'application/vnd.google-apps.folder' }),
  })
  const j = await c.json()
  if (!c.ok || !j.id) throw new Error('Não consegui criar a pasta no seu Drive.')
  await prisma.$executeRawUnsafe(`UPDATE "EstudioDriveConta" SET "pastaId"=$2 WHERE "userId"=$1`, userId, j.id)
  return j.id
}

/**
 * Abre uma sessão de upload resumable NO DRIVE DELA. Devolve a URL da sessão (ela mesma é a
 * autorização, válida por ~1 semana, só para ESTE arquivo) — o token nunca sai do servidor.
 * `origin` habilita o navegador a enviar direto (CORS da sessão).
 */
export async function abrirSessaoUpload(
  workspaceId: string, userId: string, arq: { nome: string; mime: string; tamanho: number }, origin: string,
): Promise<{ ok: true; uploadUrl: string } | { ok: false; erro: string; desconectado?: boolean }> {
  const access = await accessToken(workspaceId, userId)
  if (!access) return { ok: false, erro: 'Conecte seu Google Drive de novo.', desconectado: true }
  const pasta = await pastaDoSoa(access, userId)
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink,size', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access}`, 'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': arq.mime || 'application/octet-stream', 'X-Upload-Content-Length': String(arq.tamanho), Origin: origin,
    },
    body: JSON.stringify({ name: arq.nome.slice(0, 200), parents: [pasta] }),
  })
  const loc = r.headers.get('location')
  if (!r.ok || !loc) return { ok: false, erro: 'O Google recusou abrir o envio. Tente de novo.' }
  return { ok: true, uploadUrl: loc }
}

/** A URL de sessão veio do cliente: só aceitamos o endpoint de upload do Drive (evita SSRF). */
export function sessaoDoDrive(u: unknown): u is string {
  if (typeof u !== 'string') return false
  try {
    const x = new URL(u)
    return x.protocol === 'https:' && x.hostname === 'www.googleapis.com' && x.pathname.startsWith('/upload/drive/v3/files') && x.searchParams.has('upload_id')
  } catch { return false }
}

/** Confere que o arquivo existe no Drive dela (e é do SOA, pelo escopo drive.file) e devolve o link. */
export async function confirmarArquivo(workspaceId: string, userId: string, fileId: string) {
  const access = await accessToken(workspaceId, userId)
  if (!access) return null
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,webViewLink,size,mimeType`, { headers: { Authorization: `Bearer ${access}` } })
  if (!r.ok) return null
  const j = await r.json()
  return { id: j.id as string, nome: j.name as string, link: (j.webViewLink as string) || `https://drive.google.com/file/d/${j.id}/view`, tamanho: Number(j.size) || 0, mime: (j.mimeType as string) || null }
}
