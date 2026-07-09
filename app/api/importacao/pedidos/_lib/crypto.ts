// Criptografia do CPF em repouso (LGPD). AES-256-GCM com chave derivada de
// CPF_ENCRYPTION_KEY (env). Sem a chave, retorna null e o CPF NÃO é gravado
// (a importação segue normal). O CPF nunca sai em listagem/log/export.
import crypto from 'crypto'

function getKey(): Buffer | null {
  const raw = process.env.CPF_ENCRYPTION_KEY
  if (!raw || !raw.trim()) return null
  // Deriva 32 bytes determinísticos a partir do segredo do ambiente
  return crypto.createHash('sha256').update(raw).digest()
}

// Retorna blob "v1:iv:tag:ciphertext" (base64) ou null se não houver chave/valor
export function encryptCpf(plain: string | null | undefined): string | null {
  const s = String(plain ?? '').replace(/\D/g, '')
  if (!s) return null
  const key = getKey()
  if (!key) return null
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(s, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`
}

// Descriptografa (uso futuro/restrito — nunca em listagem). Retorna null em falha.
export function decryptCpf(blob: string | null | undefined): string | null {
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

// Máscara para exibição futura (nunca expõe o CPF completo)
export function maskCpf(plain: string | null | undefined): string | null {
  const s = String(plain ?? '').replace(/\D/g, '')
  if (s.length !== 11) return null
  return `***.***.${s.slice(6, 9)}-**`
}
