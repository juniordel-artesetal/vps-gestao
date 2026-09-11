// Criptografia dos tokens do TikTok Shop (AES-256-GCM). Mesmo esquema do ML/asaas.
// Chave = sha256(INTEGRACOES_TOKEN_KEY). Blob: "v1:<iv>:<tag>:<ct>".
// Chave DEDICADA: sem fallback para NEXTAUTH_SECRET — se essa chave mudar, os tokens
// já cifrados ficam ilegíveis; por isso é definida UMA vez e nunca trocada. Sem a
// chave → null (não guarda token em texto puro; força configurar o env).
import crypto from 'node:crypto'

function getKey(): Buffer | null {
  const raw = process.env.INTEGRACOES_TOKEN_KEY
  if (!raw) return null
  return crypto.createHash('sha256').update(raw).digest()
}

export function encryptToken(plain: string | null | undefined): string | null {
  if (plain == null || plain === '') return null
  const key = getKey()
  if (!key) return null
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`
}

export function decryptToken(blob: string | null | undefined): string | null {
  if (!blob || typeof blob !== 'string' || !blob.startsWith('v1:')) return null
  const key = getKey()
  if (!key) return null
  try {
    const [, ivB64, tagB64, ctB64] = blob.split(':')
    const iv = Buffer.from(ivB64, 'base64')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}
