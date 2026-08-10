// Criptografia dos tokens de logística em repouso (AES-256-GCM), mesma linha do CPF.
// Chave derivada de LOGISTICA_TOKEN_KEY (fallback CPF_ENCRYPTION_KEY). Sem chave → null
// (o fluxo detecta e pede reconexão; tokens NUNCA vão em claro pro client/log).
import crypto from 'crypto'

function getKey(): Buffer | null {
  const raw = process.env.LOGISTICA_TOKEN_KEY || process.env.CPF_ENCRYPTION_KEY
  if (!raw || !raw.trim()) return null
  return crypto.createHash('sha256').update(raw).digest()
}

export function temChaveCripto(): boolean {
  return getKey() !== null
}

// "v1:iv:tag:ciphertext" (base64) ou null
export function encryptToken(plain: string | null | undefined): string | null {
  const s = String(plain ?? '')
  if (!s) return null
  const key = getKey()
  if (!key) return null
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(s, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`
}

export function decryptToken(blob: string | null | undefined): string | null {
  if (!blob || !blob.startsWith('v1:')) return null
  const key = getKey()
  if (!key) return null
  try {
    const [, ivB64, tagB64, dataB64] = blob.split(':')
    const iv = Buffer.from(ivB64, 'base64')
    const tag = Buffer.from(tagB64, 'base64')
    const data = Buffer.from(dataB64, 'base64')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  } catch { return null }
}
