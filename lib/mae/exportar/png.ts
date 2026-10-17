// mae-exportar — DPI gravado no arquivo: PNG (chunk pHYs) e JPEG (densidade do JFIF). O navegador não
// grava; sem isso o PNG de 300 dpi abre "a 96 dpi" e sai do tamanho errado em alguns programas. Puro.
const TABELA = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
  return t
})()
function crc32(b: Uint8Array): number {
  let c = 0xffffffff
  for (const v of b) c = TABELA[(c ^ v) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const be32 = (v: number) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]

/** Insere o pHYs logo depois do IHDR (e tira um pHYs que já exista). */
export function comPhys(png: Uint8Array, dpi: number): Uint8Array {
  const ppm = Math.round(dpi / 0.0254)
  const corpo = new Uint8Array([...'pHYs'].map(c => c.charCodeAt(0)).concat(be32(ppm), be32(ppm), [1]))
  const chunk = new Uint8Array([...be32(9), ...corpo, ...be32(crc32(corpo))])
  const fimIhdr = 8 + 12 + 13
  const partes: Uint8Array[] = [png.slice(0, fimIhdr), chunk]
  let i = fimIhdr
  while (i + 8 <= png.length) {
    const len = ((png[i] << 24) | (png[i + 1] << 16) | (png[i + 2] << 8) | png[i + 3]) >>> 0
    const tipo = String.fromCharCode(png[i + 4], png[i + 5], png[i + 6], png[i + 7])
    const fim = i + 12 + len
    if (tipo !== 'pHYs') partes.push(png.slice(i, fim))
    i = fim
  }
  const out = new Uint8Array(partes.reduce((s, p) => s + p.length, 0))
  let o = 0
  for (const p of partes) { out.set(p, o); o += p.length }
  return out
}

/** Grava o DPI no APP0/JFIF do JPEG (se houver). */
export function jpgComDpi(jpg: Uint8Array, dpi: number): Uint8Array {
  const out = jpg.slice()
  if (out[2] === 0xff && out[3] === 0xe0 && String.fromCharCode(out[6], out[7], out[8], out[9]) === 'JFIF') {
    out[13] = 1; out[14] = dpi >> 8; out[15] = dpi & 255; out[16] = dpi >> 8; out[17] = dpi & 255
  }
  return out
}

/**
 * Lote 23 (item 267): os DPI gravados no arquivo — PNG (chunk pHYs em metros) e JPEG (JFIF em pol. ou cm). Sem a
 * informação (ou absurda), null: quem chama usa 300. Puro.
 */
export function dpiDaImagem(b: Uint8Array): number | null {
  const ok = (v: number) => (v >= 50 && v <= 2400 ? Math.round(v) : null)
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    let i = 8
    while (i + 12 <= b.length) {
      const len = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0
      const tipo = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7])
      if (tipo === 'pHYs' && len >= 9) {
        const d = i + 8
        const ppm = ((b[d] << 24) | (b[d + 1] << 16) | (b[d + 2] << 8) | b[d + 3]) >>> 0
        return b[d + 8] === 1 ? ok(ppm * 0.0254) : null
      }
      if (tipo === 'IDAT' || tipo === 'IEND') return null
      i += 12 + len
    }
    return null
  }
  if (b.length > 18 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff && b[3] === 0xe0 && String.fromCharCode(b[6], b[7], b[8], b[9]) === 'JFIF') {
    const un = b[13], x = (b[14] << 8) | b[15]
    return un === 1 ? ok(x) : un === 2 ? ok(x * 2.54) : null
  }
  return null
}

