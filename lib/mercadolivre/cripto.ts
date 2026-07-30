// Criptografia de tokens do Mercado Livre (AES-256-GCM). Mesmo esquema do googledrive/asaas.
// Chave = sha256(ML_TOKEN_KEY || NEXTAUTH_SECRET). Blob: "v1:<iv b64>:<tag b64>:<ct b64>".
// Sem chave → null (força reconexão; nunca guarda token em claro).
import crypto from 'node:crypto'

function getKey(): Buffer | null {
  const raw = process.env.ML_TOKEN_KEY || process.env.NEXTAUTH_SECRET
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
