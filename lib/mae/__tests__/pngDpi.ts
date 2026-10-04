// Apoio dos testes: grava o DPI num PNG (chunk pHYs, com CRC certo) — o @napi-rs/canvas não grava.
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

export function comPhys(png: Uint8Array, dpi: number): Uint8Array {
  const ppm = Math.round(dpi / 0.0254)
  const corpo = new Uint8Array([...'pHYs'].map(c => c.charCodeAt(0)).concat(be32(ppm), be32(ppm), [1]))
  const chunk = new Uint8Array([...be32(9), ...corpo, ...be32(crc32(corpo))])
  const fimIhdr = 8 + 12 + 13   // assinatura + chunk IHDR (13 bytes de dados)
  return new Uint8Array([...png.slice(0, fimIhdr), ...chunk, ...png.slice(fimIhdr)])
}

/** JPEG mínimo só com cabeçalho JFIF (para testar a leitura do DPI, não decodifica). */
export function cabecalhoJfif(dpi: number, unidade: 1 | 2 = 1): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, unidade, dpi >> 8, dpi & 255, dpi >> 8, dpi & 255, 0, 0, 0xff, 0xd9])
}
