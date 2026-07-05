// PIX "copia e cola" (BR Code EMV) estático COM valor — sem gateway.
// Confirmação é manual/por comprovante (chave crua não tem webhook).

// Remove acentos e caracteres fora do padrão para os campos de nome/cidade
function limpaTexto(s: string, max: number): string {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .toUpperCase()
    .trim()
    .slice(0, max)
}

// TLV: id + comprimento (2 dígitos) + valor
function tlv(id: string, valor: string): string {
  const len = valor.length.toString().padStart(2, '0')
  return `${id}${len}${valor}`
}

// CRC16-CCITT (poly 0x1021, init 0xFFFF) — sobre a string incluindo "6304"
export function crc16(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1)
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

// txid: alfanumérico, máx 25 (fallback '***')
function limpaTxid(s: string): string {
  const t = String(s || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25)
  return t || '***'
}

/**
 * Gera o payload "copia e cola" do PIX.
 * @param chave  chave PIX (email, telefone, CPF/CNPJ, aleatória)
 * @param nome   nome do recebedor (máx 25)
 * @param cidade cidade do recebedor (máx 15)
 * @param valor  valor em reais (número)
 * @param txid   identificador (ex.: número do pedido)
 */
export function gerarBRCode(opts: { chave: string; nome: string; cidade: string; valor: number; txid?: string }): string {
  const chave = String(opts.chave || '').trim()
  if (!chave) throw new Error('Chave PIX ausente')

  const mai = tlv('00', 'br.gov.bcb.pix') + tlv('01', chave)     // Merchant Account Info (26)
  const valorStr = (Number(opts.valor) || 0).toFixed(2)
  const adicional = tlv('05', limpaTxid(opts.txid || '***'))      // Additional Data (62) -> txid (05)

  let payload =
    tlv('00', '01') +                       // Payload Format Indicator
    tlv('01', '11') +                        // Point of Initiation Method (11 = estático reutilizável)
    tlv('26', mai) +                         // Merchant Account Information (PIX)
    tlv('52', '0000') +                      // Merchant Category Code
    tlv('53', '986') +                       // Moeda (BRL)
    tlv('54', valorStr) +                    // Valor
    tlv('58', 'BR') +                        // País
    tlv('59', limpaTexto(opts.nome, 25) || 'RECEBEDOR') +  // Nome
    tlv('60', limpaTexto(opts.cidade, 15) || 'CIDADE') +   // Cidade
    tlv('62', adicional)                     // Dados adicionais (txid)

  payload += '6304'                          // campo CRC (id 63, len 04) — CRC calculado sobre isto tudo
  return payload + crc16(payload)
}
