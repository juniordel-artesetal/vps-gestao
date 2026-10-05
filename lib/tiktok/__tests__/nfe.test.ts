// NF-e do pedido TikTok BR: validação do XML antes de subir e motivos do webhook 36.
import { describe, it, expect } from 'vitest'
import { validarXmlNfe, chaveDaNfe, motivoNfeInvalida, exigeNfe, nfeJaNoTikTok } from '@/lib/tiktok/nfe'

const CHAVE = '35251012345678000199550010000012341000012345'   // modelo 55 nas posições 21-22
const xml = (extra = '<protNFe><infProt><chNFe>' + CHAVE + '</chNFe></infProt></protNFe>') =>
  `<?xml version="1.0"?><nfeProc><NFe><infNFe Id="NFe${CHAVE}" versao="4.00"></infNFe></NFe>${extra}</nfeProc>`

describe('XML da NF-e', () => {
  it('XML autorizado passa e devolve a chave', () => {
    expect(validarXmlNfe(xml())).toEqual({ ok: true, chave: CHAVE })
    expect(chaveDaNfe(`<infNFe Id='NFe${CHAVE}'>`)).toBe(CHAVE)
  })
  it('recusa vazio, PDF/texto, sem protocolo, NFC-e (65) e > 1 MB', () => {
    expect(validarXmlNfe('').ok).toBe(false)
    expect(validarXmlNfe('%PDF-1.4 danfe').ok).toBe(false)
    const semProt = validarXmlNfe(xml('')); expect(!semProt.ok && semProt.erro).toMatch(/AUTORIZADA/)
    const nfce = CHAVE.slice(0, 20) + '65' + CHAVE.slice(22)
    const r = validarXmlNfe(xml().replaceAll(CHAVE, nfce)); expect(!r.ok && r.erro).toMatch(/modelo 55/)
    expect(validarXmlNfe(xml() + ' '.repeat(1024 * 1024)).ok).toBe(true)          // espaço final é aparado
    expect(validarXmlNfe(xml('<x>' + 'a'.repeat(1024 * 1024) + '</x>')).ok).toBe(false)
  })
})

describe('TikTok', () => {
  it('motivos do INVALID em português e need_upload_invoice', () => {
    expect(motivoNfeInvalida('CNPJ_NOT_MATCH')).toMatch(/CNPJ/)
    expect(motivoNfeInvalida('UF_Inconsistent_Required')).toMatch(/estado/)
    expect(motivoNfeInvalida('NOT_AUTHORIZED')).toMatch(/não está autorizada/)
    expect(motivoNfeInvalida(undefined)).toMatch(/tente de novo/)
    expect(exigeNfe('NEED_INVOICE')).toBe(true); expect(exigeNfe('NO_NEED')).toBe(false)
    expect(nfeJaNoTikTok('INVOICE_UPLOADED')).toBe(true)
  })
})
