// SOA Edition — ACERVO DA NATY: conexão ÚNICA da PLATAFORMA com o Google Drive de conteúdo (≠ Drive por
// usuário das artesãs, lib/estudio/drive; ≠ lib/googledrive dos vídeos do suporte).
// • Escopo drive.readonly: o acervo é criado pela Naty (drive.file não enxergaria). Só leitura.
// • Tokens cifrados (AES-256-GCM, INTEGRACOES_TOKEN_KEY — não rotacionar). Nunca vão para cliente/log.
// • SYNC (cron semanal + botão no Master): lista a pasta (subpasta = categoria), DEDUP por fileId + versão
//   (md5/modifiedTime), copia o ORIGINAL para o Blob e cria o template especial como
//   'pendente_curadoria'. O processamento pelo roteador de camadas acontece na curadoria (navegador do
//   Master) — e NADA é publicado sem aprovação.
import { put } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { encryptToken, decryptToken } from '@/lib/tiktok/cripto'
import { criarState, validarState } from './drive'
import { ensureEspeciais, ACERVO_WS } from './especiais'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
const ID_CONFIG = 'naty'
const DONO_STATE = 'master-acervo'
const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export const acervoConfigurado = () => !!(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.INTEGRACOES_TOKEN_KEY && process.env.BLOB_READ_WRITE_TOKEN)
export function redirectAcervo(origin: string): string {
  if (process.env.ESTUDIO_ACERVO_REDIRECT_URI) return process.env.ESTUDIO_ACERVO_REDIRECT_URI
  return `${(process.env.NEXTAUTH_URL || origin).replace(/\/+$/, '')}/api/master/estudio/acervo/callback`
}
export function iniciarOAuth(origin: string): { url: string; nonce: string } {
  const { state, nonce } = criarState(DONO_STATE)
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!, redirect_uri: redirectAcervo(origin), response_type: 'code',
    scope: SCOPE, access_type: 'offline', prompt: 'consent', state,
  })
  return { url: `${AUTH_URL}?${p.toString()}`, nonce }
}
export const stateValido = (state: string | null, nonce: string | undefined) => validarState(state, DONO_STATE, nonce)

interface Tokens { r: string | null; a: string; x: number }
async function salvar(t: Tokens, email: string | null) {
  const c = encryptToken(JSON.stringify(t))
  if (!c) throw new Error('Cofre de tokens indisponível')
  await prisma.$executeRawUnsafe(
    `INSERT INTO "EstudioAcervoConfig" ("id","tokensCifrados","email") VALUES ($1,$2,$3)
     ON CONFLICT ("id") DO UPDATE SET "tokensCifrados"=EXCLUDED."tokensCifrados", "email"=COALESCE(EXCLUDED."email","EstudioAcervoConfig"."email"), "atualizadoEm"=now()`,
    ID_CONFIG, c, email)
}
async function ler(): Promise<{ t: Tokens | null; pastaId: string | null; email: string | null }> {
  const [r] = await prisma.$queryRawUnsafe<{ c: string | null; p: string | null; e: string | null }[]>(`SELECT "tokensCifrados" AS c, "pastaId" AS p, "email" AS e FROM "EstudioAcervoConfig" WHERE "id"=$1`, ID_CONFIG)
  let t: Tokens | null = null
  const plano = decryptToken(r?.c || undefined)
  if (plano) { try { t = JSON.parse(plano) } catch { t = null } }
  return { t, pastaId: r?.p ?? null, email: r?.e ?? null }
}

export async function conectarAcervo(code: string, origin: string): Promise<boolean> {
  await ensureEspeciais()
  const r = await fetch(TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!, client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!, redirect_uri: redirectAcervo(origin), grant_type: 'authorization_code' }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.access_token) return false
  const antigo = await ler()
  let email: string | null = null
  try { const a = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', { headers: { Authorization: `Bearer ${j.access_token}` } }); if (a.ok) email = (await a.json()).user?.emailAddress ?? null } catch { /* só exibição */ }
  await salvar({ r: j.refresh_token || antigo.t?.r || null, a: j.access_token, x: Date.now() + (Number(j.expires_in || 3600) - 60) * 1000 }, email)
  return true
}

async function token(): Promise<string | null> {
  const { t } = await ler()
  if (!t) return null
  if (t.a && t.x > Date.now()) return t.a
  if (!t.r) return null
  const r = await fetch(TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!, client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!, refresh_token: t.r, grant_type: 'refresh_token' }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.access_token) return null
  await salvar({ r: t.r, a: j.access_token, x: Date.now() + (Number(j.expires_in || 3600) - 60) * 1000 }, null)
  return j.access_token
}

export async function statusAcervo(): Promise<{ configurado: boolean; conectado: boolean; email: string | null; pastaId: string | null }> {
  await ensureEspeciais()
  const c = await ler()
  return { configurado: acervoConfigurado(), conectado: !!c.t, email: c.email, pastaId: c.pastaId }
}
export async function definirPasta(pastaId: string): Promise<void> {
  await ensureEspeciais()
  const id = (pastaId.match(/folders\/([\w-]{10,})/)?.[1] || pastaId).trim()
  if (!/^[\w-]{10,}$/.test(id)) throw new Error('Id de pasta inválido (cole o link da pasta do Drive).')
  await prisma.$executeRawUnsafe(
    `INSERT INTO "EstudioAcervoConfig" ("id","pastaId") VALUES ($1,$2) ON CONFLICT ("id") DO UPDATE SET "pastaId"=EXCLUDED."pastaId", "atualizadoEm"=now()`, ID_CONFIG, id)
}
export async function desconectarAcervo(): Promise<void> {
  await prisma.$executeRawUnsafe(`UPDATE "EstudioAcervoConfig" SET "tokensCifrados"=NULL, "atualizadoEm"=now() WHERE "id"=$1`, ID_CONFIG)
}

// ── listagem (subpastas = categorias, até 2 níveis) ────────────────────────────
const ACEITOS = /\.(psd|psb|pdf|ai|svg|png|jpe?g|webp)$/i
interface ArqDrive { id: string; name: string; mimeType: string; md5Checksum?: string; modifiedTime?: string; size?: string; categoria: string }

async function listar(access: string, pasta: string, categoria: string, nivel: number, out: ArqDrive[]) {
  let pageToken = ''
  do {
    const q = encodeURIComponent(`'${pasta}' in parents and trashed = false`)
    const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name,mimeType,md5Checksum,modifiedTime,size)&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true${pageToken ? `&pageToken=${pageToken}` : ''}`, { headers: { Authorization: `Bearer ${access}` } })
    if (!r.ok) throw new Error(`Drive respondeu ${r.status} ao listar a pasta`)
    const j = await r.json() as { nextPageToken?: string; files?: Omit<ArqDrive, 'categoria'>[] }
    for (const f of j.files || []) {
      if (f.mimeType === 'application/vnd.google-apps.folder') { if (nivel < 2) await listar(access, f.id, categoria ? `${categoria} / ${f.name}` : f.name, nivel + 1, out) }
      else if (ACEITOS.test(f.name)) out.push({ ...f, categoria: categoria || 'Geral' })
    }
    pageToken = j.nextPageToken || ''
  } while (pageToken)
}

const MIME: Record<string, string> = { psd: 'image/vnd.adobe.photoshop', psb: 'image/vnd.adobe.photoshop', pdf: 'application/pdf', ai: 'application/pdf', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }
const MAX_BYTES = 300 * 1024 * 1024

/**
 * Sincroniza: arquivo novo → template 'pendente_curadoria'; arquivo alterado → NOVA versão pendente (a
 * publicada continua no ar até a nova ser aprovada); igual → ignora. Para antes do limite de tempo e
 * continua na próxima execução.
 */
export async function sincronizarAcervo(origem: 'cron' | 'manual', orcamentoMs = 240_000): Promise<{ novos: number; atualizados: number; iguais: number; erros: number; pendentesDeTempo: number; detalhes: string[] }> {
  await ensureEspeciais()
  const inicio = Date.now()
  const { pastaId } = await ler()
  const access = await token()
  if (!access) throw new Error('Drive do acervo não conectado (ou a autorização expirou) — conecte de novo no Master.')
  if (!pastaId) throw new Error('Defina a pasta do acervo no Master.')
  const arquivos: ArqDrive[] = []
  await listar(access, pastaId, '', 0, arquivos)
  const existentes = await prisma.$queryRawUnsafe<{ driveFileId: string; driveVersao: string | null; versao: number }[]>(
    `SELECT "driveFileId","driveVersao","versao" FROM "EstudioTemplate" WHERE "workspaceId"=$1 AND "driveFileId" IS NOT NULL`, ACERVO_WS)
  const porArquivo = new Map<string, { versoes: Set<string>; max: number }>()
  for (const e of existentes) {
    const x = porArquivo.get(e.driveFileId) || { versoes: new Set<string>(), max: 0 }
    if (e.driveVersao) x.versoes.add(e.driveVersao); x.max = Math.max(x.max, Number(e.versao) || 1); porArquivo.set(e.driveFileId, x)
  }
  let novos = 0, atualizados = 0, iguais = 0, erros = 0, pendentesDeTempo = 0
  const detalhes: string[] = []
  for (const f of arquivos) {
    const versao = f.md5Checksum || f.modifiedTime || ''
    const ja = porArquivo.get(f.id)
    if (ja?.versoes.has(versao)) { iguais++; continue }
    if (Date.now() - inicio > orcamentoMs) { pendentesDeTempo++; continue }
    if (Number(f.size || 0) > MAX_BYTES) { erros++; detalhes.push(`${f.name}: maior que 300 MB — exporte menor`); continue }
    try {
      const r = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${access}` } })
      if (!r.ok || !r.body) throw new Error(`download ${r.status}`)
      const ext = (f.name.match(/\.(\w+)$/)?.[1] || '').toLowerCase()
      const limpo = f.name.normalize('NFC').replace(/[^\w.\-]+/g, '_').slice(0, 120)
      const blob = await put(`estudio/${ACERVO_WS}/original/${limpo}`, r.body, { access: 'public', addRandomSuffix: true, contentType: MIME[ext] || 'application/octet-stream', multipart: Number(f.size || 0) > 50 * 1024 * 1024 })
      const nome = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 120)
      await prisma.$executeRawUnsafe(
        `INSERT INTO "EstudioTemplate" ("id","workspaceId","nome","config","origem","status","driveFileId","driveVersao","versao","categoria","arquivoUrl","arquivoNome","processado")
         VALUES ($1,$2,$3,'{}'::jsonb,'naty','pendente_curadoria',$4,$5,$6,$7,$8,$9,false)`,
        gid(), ACERVO_WS, nome, f.id, versao, (ja?.max || 0) + 1, f.categoria.slice(0, 80), blob.url, f.name.slice(0, 200))
      if (ja) { atualizados++; detalhes.push(`${f.name}: nova versão ${ja.max + 1} (a publicada segue no ar até aprovar)`) } else novos++
    } catch (e) { erros++; detalhes.push(`${f.name}: ${(e as Error).message}`) }
  }
  if (pendentesDeTempo) detalhes.push(`${pendentesDeTempo} arquivo(s) ficaram para a próxima sincronização (limite de tempo).`)
  await prisma.$executeRawUnsafe(
    `INSERT INTO "EstudioAcervoSync" ("id","origem","novos","atualizados","iguais","erros","detalhes") VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    gid(), origem, novos, atualizados, iguais, erros, JSON.stringify(detalhes.slice(0, 100)))
  return { novos, atualizados, iguais, erros, pendentesDeTempo, detalhes }
}
