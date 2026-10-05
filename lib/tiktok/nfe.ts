// NF-e no pedido do TikTok Shop BR — regras PURAS (testáveis). O TikTok BR exige a nota no pedido
// ANTES do "pronto para envio": sem ela o ship volta "Need invoice uploaded for all order before rts".
// Upload Invoice (202502) aceita SÓ o XML da NF-e autorizada (base64, máx. 1 MB); o TikTok valida
// na SEFAZ e devolve o resultado no webhook 36 (SUCCESS/PROCESSING/FAILED/INVALID + motivo).
// O SOA não emite NF-e: a artesã emite onde já emite e anexa o XML no pedido (ou emite pelo
// Seller Center, que já marca INVOICE_UPLOADED no TikTok).

export const LIMITE_XML_BYTES = 1024 * 1024

/** Chave de acesso (44 dígitos) do XML da NF-e — <chNFe> do protocolo ou o Id do infNFe. */
export function chaveDaNfe(xml: string): string | null {
  const m = xml.match(/<chNFe>\s*(\d{44})\s*<\/chNFe>/) || xml.match(/Id\s*=\s*["']NFe(\d{44})["']/)
  return m ? m[1] : null
}

/** Confere se é um XML de NF-e utilizável no TikTok (antes de subir). */
export function validarXmlNfe(xml: string): { ok: true; chave: string } | { ok: false; erro: string } {
  const t = (xml || '').trim()
  if (!t) return { ok: false, erro: 'Arquivo vazio.' }
  if (Buffer.byteLength(t, 'utf8') > LIMITE_XML_BYTES) return { ok: false, erro: 'O XML passa de 1 MB (limite do TikTok).' }
  if (!/<(nfeProc|NFe)[\s>]/.test(t) || !/<infNFe[\s>]/.test(t)) return { ok: false, erro: 'Esse arquivo não é o XML de uma NF-e (procure o arquivo .xml que o emissor gera, não o PDF/DANFE).' }
  const chave = chaveDaNfe(t)
  if (!chave) return { ok: false, erro: 'Não achei a chave de acesso (44 dígitos) no XML.' }
  if (chave.slice(20, 22) !== '55') return { ok: false, erro: 'A chave não é de NF-e modelo 55 (NFC-e/NFS-e não servem para o TikTok).' }
  if (!/<protNFe[\s>]/.test(t)) return { ok: false, erro: 'O XML não tem o protocolo de autorização da SEFAZ — use o XML da nota AUTORIZADA (nfeProc).' }
  return { ok: true, chave }
}

/** Motivo do INVALID (webhook 36) em português, com o que fazer. */
export function motivoNfeInvalida(reason: string | null | undefined): string {
  const r = String(reason || '').toUpperCase()
  if (r === 'FAILED') return 'o XML ou a chave da NF-e são inválidos — confira o arquivo'
  if (r === 'NOT_FOUND') return 'a SEFAZ ainda não encontrou essa NF-e (pode ser atraso) — tente de novo em alguns minutos'
  if (r === 'NOT_AUTHORIZED') return 'a NF-e não está autorizada na SEFAZ (não emitida ou cancelada)'
  if (r === 'ACCESS_KEY_DUPLICATE') return 'essa chave de acesso já foi usada em outro pedido'
  if (r === 'CNPJ_NOT_MATCH') return 'o CNPJ da NF-e não é o mesmo cadastrado na loja do TikTok'
  if (r.startsWith('UF_INCONSISTENT')) return 'o CNPJ da NF-e é de outro estado que o armazém — inclua o local de retirada na NF-e'
  return 'erro do TikTok ao validar a NF-e — tente de novo mais tarde'
}

/** O TikTok exige nota neste pedido? (campo need_upload_invoice do pedido, só BR) */
export const exigeNfe = (v: unknown) => String(v || '').toUpperCase() === 'NEED_INVOICE'
export const nfeJaNoTikTok = (v: unknown) => String(v || '').toUpperCase() === 'INVOICE_UPLOADED'
