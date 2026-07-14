// Adaptador do Google Drive da PLATAFORMA (conta do dono). OAuth + upload de vídeo.
// Escopo mínimo: drive.file (o app só enxerga arquivos que ELE cria). Credenciais só em
// env do servidor; refresh token criptografado no banco (GoogleDriveConfig). NUNCA no client/log/commit.
import { prisma } from '@/lib/prisma'
import { encryptToken, decryptToken } from './cripto'

const AUTH_URL  = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE     = 'https://www.googleapis.com/auth/drive.file'
const PASTA_RAIZ = 'SOA - Suporte'
const PASTA_SUB  = 'Videos'
const LIMITE_BYTES = 10 * 1024 * 1024 // ~10MB

export const TIPOS_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'video/3gpp']
export { LIMITE_BYTES }

export function credenciaisConfiguradas(): boolean {
  return !!(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REDIRECT_URI)
}

// ---- Config (linha única escopo='plataforma') --------------------------------
type DriveConfig = { refreshTokenCripto: string | null; accessTokenCripto: string | null; tokenExpiraEm: Date | null; folderId: string | null; contaEmail: string | null; conectado: boolean }

async function lerConfig(): Promise<DriveConfig | null> {
  const [row] = await prisma.$queryRaw`
    SELECT "refreshTokenCripto","accessTokenCripto","tokenExpiraEm","folderId","contaEmail","conectado"
    FROM "GoogleDriveConfig" WHERE "escopo" = 'plataforma' LIMIT 1
  ` as any[]
  return row ?? null
}

export async function statusConexao(): Promise<{ configurado: boolean; conectado: boolean; contaEmail: string | null; pastaOk: boolean }> {
  const cfg = await lerConfig()
  return {
    configurado: credenciaisConfiguradas(),
    conectado: !!cfg?.conectado && !!cfg?.refreshTokenCripto,
    contaEmail: cfg?.contaEmail ?? null,
    pastaOk: !!cfg?.folderId,
  }
}

// ---- OAuth -------------------------------------------------------------------
export function urlAutorizacao(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_DRIVE_REDIRECT_URI!,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',           // força devolver refresh_token
    include_granted_scopes: 'true',
    state,
  })
  return `${AUTH_URL}?${p.toString()}`
}

// Troca o code por tokens e persiste (refresh criptografado). Retorna o email da conta.
export async function conectarComCode(code: string): Promise<{ ok: boolean; email: string | null; erro?: string }> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
    redirect_uri: process.env.GOOGLE_DRIVE_REDIRECT_URI!,
    grant_type: 'authorization_code',
  })
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  const j = await r.json()
  if (!r.ok || !j.access_token) return { ok: false, email: null, erro: j.error_description || j.error || 'falha ao obter token' }

  const refresh = j.refresh_token || null
  const expira = new Date(Date.now() + (Number(j.expires_in || 3600) - 60) * 1000)
  let email: string | null = null
  try {
    const u = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${j.access_token}` } })
    if (u.ok) email = (await u.json()).email ?? null
  } catch {}

  const refreshEnc = refresh ? encryptToken(refresh) : null
  const accessEnc  = encryptToken(j.access_token)
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
  // upsert por escopo; se não veio refresh (reconsentimento sem prompt), preserva o anterior
  await prisma.$executeRaw`
    INSERT INTO "GoogleDriveConfig" ("id","escopo","refreshTokenCripto","accessTokenCripto","tokenExpiraEm","contaEmail","conectado","updatedAt")
    VALUES (${id}, 'plataforma', ${refreshEnc}, ${accessEnc}, ${expira}, ${email}, true, NOW())
    ON CONFLICT ("escopo") DO UPDATE SET
      "refreshTokenCripto" = COALESCE(${refreshEnc}, "GoogleDriveConfig"."refreshTokenCripto"),
      "accessTokenCripto"  = ${accessEnc},
      "tokenExpiraEm"      = ${expira},
      "contaEmail"         = ${email},
      "conectado"          = true,
      "updatedAt"          = NOW()
  `
  return { ok: true, email }
}

export async function desconectar(): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "GoogleDriveConfig" SET "conectado" = false, "refreshTokenCripto" = NULL,
      "accessTokenCripto" = NULL, "tokenExpiraEm" = NULL, "updatedAt" = NOW()
    WHERE "escopo" = 'plataforma'
  `
}

// Retorna um access token válido (renova via refresh se expirado). null = precisa reconectar.
async function accessTokenValido(): Promise<string | null> {
  const cfg = await lerConfig()
  if (!cfg || !cfg.conectado) return null
  const accessAtual = decryptToken(cfg.accessTokenCripto)
  if (accessAtual && cfg.tokenExpiraEm && new Date(cfg.tokenExpiraEm).getTime() > Date.now()) return accessAtual

  const refresh = decryptToken(cfg.refreshTokenCripto)
  if (!refresh) return null
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
    refresh_token: refresh,
    grant_type: 'refresh_token',
  })
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  const j = await r.json()
  if (!r.ok || !j.access_token) return null
  const expira = new Date(Date.now() + (Number(j.expires_in || 3600) - 60) * 1000)
  await prisma.$executeRaw`
    UPDATE "GoogleDriveConfig" SET "accessTokenCripto" = ${encryptToken(j.access_token)},
      "tokenExpiraEm" = ${expira}, "updatedAt" = NOW() WHERE "escopo" = 'plataforma'
  `
  return j.access_token
}

// ---- Pasta destino -----------------------------------------------------------
async function acharOuCriarPasta(access: string, nome: string, paiId?: string): Promise<string> {
  const paiQ = paiId ? ` and '${paiId}' in parents` : ''
  const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${nome}' and trashed=false${paiQ}`)
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, { headers: { Authorization: `Bearer ${access}` } })
  const j = await r.json()
  if (j.files?.length) return j.files[0].id
  const meta: any = { name: nome, mimeType: 'application/vnd.google-apps.folder' }
  if (paiId) meta.parents = [paiId]
  const c = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST', headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' }, body: JSON.stringify(meta),
  })
  return (await c.json()).id
}

async function pastaDestino(access: string): Promise<string> {
  const cfg = await lerConfig()
  if (cfg?.folderId) return cfg.folderId
  const raiz = await acharOuCriarPasta(access, PASTA_RAIZ)
  const sub  = await acharOuCriarPasta(access, PASTA_SUB, raiz)
  await prisma.$executeRaw`UPDATE "GoogleDriveConfig" SET "folderId" = ${sub}, "updatedAt" = NOW() WHERE "escopo" = 'plataforma'`
  return sub
}

// ---- Upload de vídeo ---------------------------------------------------------
// Sobe o buffer pro Drive do dono e libera visualização por link (necessário pra tocar no chat).
// Retorna fileId + link de visualização (webViewLink).
export async function uploadVideo(buffer: Buffer, filename: string, mime: string): Promise<{ fileId: string; url: string }> {
  const access = await accessTokenValido()
  if (!access) throw new Error('DRIVE_DESCONECTADO')
  const folderId = await pastaDestino(access)

  const boundary = '----soaVideo' + Math.random().toString(36).slice(2)
  const meta = JSON.stringify({ name: filename, parents: [folderId] })
  const pre  = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`, 'utf8')
  const post = Buffer.from(`\r\n--${boundary}--`, 'utf8')
  const corpo = Buffer.concat([pre, buffer, post])

  const up = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': `multipart/related; boundary=${boundary}`, 'Content-Length': String(corpo.length) },
    body: corpo,
  })
  const j = await up.json()
  if (!up.ok || !j.id) throw new Error(j.error?.message || 'falha no upload')

  // Link "qualquer pessoa com o link pode ver" — id do Drive é longo/imprevisível; sem ele o vídeo não toca.
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${j.id}/permissions`, {
      method: 'POST', headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    })
  } catch {}

  const url = j.webViewLink || `https://drive.google.com/file/d/${j.id}/view`
  return { fileId: j.id, url }
}
