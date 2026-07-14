// Criptografia dos tokens do Google Drive em repouso (AES-256-GCM). Chave de
// GOOGLE_DRIVE_TOKEN_KEY (fallback NEXTAUTH_SECRET). Sem chave → null (o fluxo pede reconexão).
// Tokens NUNCA vão em claro pro client/log.
import crypto from 'crypto'

function getKey(): Buffer | null {
  const raw = process.env.GOOGLE_DRIVE_TOKEN_KEY || process.env.NEXTAUTH_SECRET
  if (!raw || !raw.trim()) return null
  return crypto.createHash('sha256').update(raw).digest()
}

export function encryptToken(plain: string | null | undefined): string | null {
  const s = String(plain ?? '')
  if (!s) return null
  const key = getKey(); if (!key) return null
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(s, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`
}

export function decryptToken(blob: string | null | undefined): string | null {
  if (!blob || !blob.startsWith('v1:')) return null
  const key = getKey(); if (!key) return null
  try {
    const [, ivB64, tagB64, dataB64] = blob.split(':')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
  } catch { return null }
}
