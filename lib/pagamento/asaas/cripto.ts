// Criptografia em repouso das credenciais do Asaas (AES-256-GCM).
//
// Módulo PRÓPRIO de propósito: o motor de pagamento não pode depender de
// lib/logistica para funcionar — são frentes independentes, e um import cruzado
// faria o build quebrar sempre que uma delas não estivesse presente.
//
// Chave: ASAAS_TOKEN_KEY, com fallback para LOGISTICA_TOKEN_KEY / CPF_ENCRYPTION_KEY.
// A derivação (sha256 da raw) e o formato ("v1:iv:tag:dados") são IDÊNTICOS aos de
// lib/logistica/cripto — então o que já tiver sido gravado com a chave antiga segue
// legível pelo fallback.
//
// ⚠️ Trocar a chave torna ilegível o que foi cifrado com a anterior. Se ASAAS_TOKEN_KEY
//    passar a existir depois de credenciais já salvas, elas precisam ser regravadas
//    pela tela /master/asaas (a API key volta a ser pedida; nada quebra em silêncio,
//    o teste de conexão acusa).
//
// Sem chave nenhuma → retorna null: o fluxo detecta e pede reconexão. Segredo NUNCA
// vai em claro para o client, log ou resposta JSON.
import crypto from 'crypto'

function getKey(): Buffer | null {
  const raw = process.env.ASAAS_TOKEN_KEY
    || process.env.LOGISTICA_TOKEN_KEY
    || process.env.CPF_ENCRYPTION_KEY
  if (!raw || !raw.trim()) return null
  return crypto.createHash('sha256').update(raw).digest()
}

export function temChaveCripto(): boolean {
  return getKey() !== null
}

/** "v1:iv:tag:ciphertext" (base64) ou null. */
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
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8')
  } catch { return null }
}
