// 2FA por TOTP (RFC 6238) — SERVER-ONLY. Implementação própria sobre node:crypto,
// sem dependência externa (evita instalar lib nova num build já frágil). Cobre:
//   • geração de segredo (base32) + URI otpauth:// para o QR
//   • verificação de código TOTP com janela de tolerância (±1 passo de 30s)
//   • códigos de recuperação (backup codes): geração + hash + verificação/consumo
//   • cifra do segredo em repouso (AES-256-GCM) — nunca guardar em texto puro
import crypto from 'crypto'

const DIGITOS = 6
const PASSO_SEG = 30
const JANELA = 1 // aceita t-1, t, t+1 (relógios levemente dessincronizados)

// ── Base32 (RFC 4648, sem padding) ──────────────────────────────────────────
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(buf: Buffer): string {
  let bits = 0, valor = 0, saida = ''
  for (const byte of buf) {
    valor = (valor << 8) | byte
    bits += 8
    while (bits >= 5) {
      saida += B32[(valor >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) saida += B32[(valor << (5 - bits)) & 31]
  return saida
}

export function base32Decode(str: string): Buffer {
  const limpo = str.replace(/=+$/, '').replace(/\s/g, '').toUpperCase()
  let bits = 0, valor = 0
  const out: number[] = []
  for (const ch of limpo) {
    const idx = B32.indexOf(ch)
    if (idx === -1) continue
    valor = (valor << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((valor >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

// ── HOTP / TOTP ───────────────────────────────────────────────────────────
function hotp(segredo: Buffer, contador: number, digitos = DIGITOS): string {
  const buf = Buffer.alloc(8)
  // contador em 64 bits big-endian (writeBigInt64BE evita overflow de 32 bits)
  buf.writeBigInt64BE(BigInt(contador))
  const hmac = crypto.createHmac('sha1', segredo).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3]
  return (bin % 10 ** digitos).toString().padStart(digitos, '0')
}

export function totp(segredoBase32: string, emSegundos = Date.now() / 1000, digitos = DIGITOS): string {
  const contador = Math.floor(emSegundos / PASSO_SEG)
  return hotp(base32Decode(segredoBase32), contador, digitos)
}

/** Verifica um código TOTP dentro da janela de tolerância. */
export function verificarTotp(segredoBase32: string, codigo: string, emSegundos = Date.now() / 1000): boolean {
  const limpo = (codigo || '').replace(/\D/g, '')
  if (limpo.length !== DIGITOS) return false
  const base = Math.floor(emSegundos / PASSO_SEG)
  const segredo = base32Decode(segredoBase32)
  for (let j = -JANELA; j <= JANELA; j++) {
    const esperado = hotp(segredo, base + j)
    // comparação em tempo constante
    if (esperado.length === limpo.length &&
        crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(limpo))) return true
  }
  return false
}

/** Gera um segredo novo (20 bytes) em base32, pronto para o app autenticador. */
export function gerarSegredo(): string {
  return base32Encode(crypto.randomBytes(20))
}

/** Monta a URI otpauth:// que vira o QR Code no app autenticador. */
export function uriOtpauth(segredoBase32: string, conta: string, emissor = 'SOA'): string {
  const label = encodeURIComponent(`${emissor}:${conta}`)
  const params = new URLSearchParams({
    secret: segredoBase32,
    issuer: emissor,
    algorithm: 'SHA1',
    digits: String(DIGITOS),
    period: String(PASSO_SEG),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

// ── Códigos de recuperação (backup codes) ───────────────────────────────────
function hashCode(codigo: string): string {
  return crypto.createHash('sha256').update(codigo.replace(/[\s-]/g, '').toLowerCase()).digest('hex')
}

/** Gera N códigos de recuperação legíveis e seus hashes (só o hash vai ao banco). */
export function gerarBackupCodes(qtd = 10): { codigos: string[]; hashes: string[] } {
  const codigos: string[] = []
  const hashes: string[] = []
  const alfabeto = 'abcdefghjkmnpqrstuvwxyz23456789'
  for (let i = 0; i < qtd; i++) {
    let c = ''
    for (let k = 0; k < 8; k++) c += alfabeto[crypto.randomInt(0, alfabeto.length)]
    const fmt = c.slice(0, 4) + '-' + c.slice(4)
    codigos.push(fmt)
    hashes.push(hashCode(fmt))
  }
  return { codigos, hashes }
}

/**
 * Confere um código de recuperação contra a lista de hashes. Se casar, devolve a
 * lista de hashes SEM o consumido (uso único). Se não casar, devolve null.
 */
export function consumirBackupCode(codigo: string, hashes: string[]): string[] | null {
  const alvo = hashCode(codigo)
  const idx = hashes.findIndex(h => h.length === alvo.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(alvo)))
  if (idx === -1) return null
  return hashes.filter((_, i) => i !== idx)
}

// ── Cifra do segredo em repouso (AES-256-GCM) ────────────────────────────────
function chave(): Buffer {
  const material = process.env.TWOFA_ENC_KEY || process.env.NEXTAUTH_SECRET || ''
  if (!material) throw new Error('TWOFA: defina TWOFA_ENC_KEY ou NEXTAUTH_SECRET')
  return crypto.scryptSync(material, 'soa-2fa-v1', 32)
}

export function cifrarSegredo(segredo: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', chave(), iv)
  const enc = Buffer.concat([cipher.update(segredo, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':')
}

export function decifrarSegredo(guardado: string): string {
  const [ivB, tagB, encB] = guardado.split(':')
  const decipher = crypto.createDecipheriv('aes-256-gcm', chave(), Buffer.from(ivB, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(encB, 'base64')), decipher.final()]).toString('utf8')
}
