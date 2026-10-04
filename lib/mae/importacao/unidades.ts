// mae-importação — UNIDADES E CALIBRAÇÃO (puras): DPI gravado no PNG/JPEG, tamanho do SVG em mm,
// unidade do DXF ($INSUNITS) e as duas calibrações de imagem (largura real ou 2 cliques numa medida).

// ── DPI do arquivo ─────────────────────────────────────────────────────────────────────────────────
/** DPI gravado no arquivo (PNG pHYs; JPEG JFIF ou EXIF), ou null se não houver. */
export function lerDpi(bytes: Uint8Array): number | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return dpiPng(bytes)
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return dpiJpeg(bytes)
  return null
}

const u32 = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3]

function dpiPng(b: Uint8Array): number | null {
  let p = 8
  while (p + 12 <= b.length) {
    const len = u32(b, p)
    const tipo = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7])
    if (tipo === 'pHYs' && len >= 9) {
      const x = u32(b, p + 8), unidade = b[p + 16]
      return unidade === 1 && x > 0 ? Math.round(x * 0.0254 * 100) / 100 : null
    }
    if (tipo === 'IDAT' || tipo === 'IEND') break
    p += 12 + len
  }
  return null
}

function dpiJpeg(b: Uint8Array): number | null {
  let p = 2, exif: number | null = null
  while (p + 4 <= b.length && b[p] === 0xff) {
    const m = b[p + 1], len = (b[p + 2] << 8) + b[p + 3]
    if (m === 0xda || m === 0xd9) break
    const ini = p + 4
    if (m === 0xe0 && String.fromCharCode(...b.slice(ini, ini + 4)) === 'JFIF') {
      const unidade = b[ini + 7], x = (b[ini + 8] << 8) + b[ini + 9]
      if (unidade === 1 && x > 1) return x
      if (unidade === 2 && x > 1) return Math.round(x * 2.54 * 100) / 100
    }
    if (m === 0xe1 && String.fromCharCode(...b.slice(ini, ini + 4)) === 'Exif') exif = dpiExif(b, ini + 6)
    p += 2 + len
  }
  return exif
}

function dpiExif(b: Uint8Array, t: number): number | null {
  const le = b[t] === 0x49
  const u16 = (i: number) => (le ? b[i] + (b[i + 1] << 8) : (b[i] << 8) + b[i + 1])
  const u32e = (i: number) => (le ? b[i] + (b[i + 1] << 8) + (b[i + 2] << 16) + ((b[i + 3] << 24) >>> 0) : u32(b, i))
  const ifd = t + u32e(t + 4)
  const n = u16(ifd)
  let res: number | null = null, unidade = 2
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12, tag = u16(e)
    if (tag === 0x011a) { const off = t + u32e(e + 8); const num = u32e(off), den = u32e(off + 4); if (den) res = num / den }
    if (tag === 0x0128) unidade = u16(e + 8)
  }
  if (!res || res <= 1) return null
  return unidade === 3 ? Math.round(res * 2.54 * 100) / 100 : res
}

// ── calibração de imagem ──────────────────────────────────────────────────────────────────────────
/** px por mm a partir da largura real confirmada. */
export const pxPorMmDaLargura = (larguraPx: number, larguraMm: number) => larguraPx / larguraMm
/** px por mm a partir de 2 cliques sobre uma linha de medida conhecida. */
export function pxPorMmDaMedida(a: [number, number], b: [number, number], distanciaMm: number): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]) / distanciaMm
}
/** Largura em mm pelo DPI do arquivo (sugestão — a usuária sempre confirma). */
export const larguraPeloDpi = (larguraPx: number, dpi: number) => (larguraPx / dpi) * 25.4

// ── SVG ───────────────────────────────────────────────────────────────────────────────────────────
const MM_POR: Record<string, number> = { mm: 1, cm: 10, q: 0.25, in: 25.4, pt: 25.4 / 72, pc: 25.4 / 6, px: 25.4 / 96, '': 25.4 / 96 }

/** Comprimento SVG ("210mm", "8.5in", "300", "300px") em mm; null para % ou inválido. */
export function comprimentoSvgMm(v: string | null | undefined): number | null {
  if (!v) return null
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(mm|cm|q|in|pt|pc|px)?\s*$/i.exec(v)
  if (!m) return null
  const n = parseFloat(m[1])
  return n > 0 ? n * MM_POR[(m[2] || '').toLowerCase()] : null
}

/**
 * Tamanho do SVG em mm respeitando width/height (com unidade) e o viewBox. Sem width/height, o viewBox
 * vale em px CSS (96 por polegada). `confiavel` = veio com unidade física (mm, cm, in, pt…).
 */
export function tamanhoSvgMm(a: { width?: string | null; height?: string | null; viewBox?: string | null }): { larguraMm: number; alturaMm: number; confiavel: boolean } | null {
  const vb = (a.viewBox || '').trim().split(/[\s,]+/).map(Number)
  const temVb = vb.length === 4 && vb[2] > 0 && vb[3] > 0
  let w = comprimentoSvgMm(a.width), h = comprimentoSvgMm(a.height)
  const fisica = (v?: string | null) => !!v && /(mm|cm|q|in|pt|pc)\s*$/i.test(v)
  if (w && !h && temVb) h = (w * vb[3]) / vb[2]
  if (h && !w && temVb) w = (h * vb[2]) / vb[3]
  if (w && h) return { larguraMm: w, alturaMm: h, confiavel: fisica(a.width) || fisica(a.height) }
  if (temVb) return { larguraMm: vb[2] * MM_POR.px, alturaMm: vb[3] * MM_POR.px, confiavel: false }
  return null
}

// ── DXF ───────────────────────────────────────────────────────────────────────────────────────────
/** $INSUNITS → mm por unidade (só as unidades de comprimento usuais). */
export const MM_POR_UNIDADE_DXF: Record<number, number> = { 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000, 8: 0.0000254, 9: 0.0254, 10: 914.4, 14: 100 }
export const UNIDADES_DXF_ESCOLHA = [{ rotulo: 'milímetros', mm: 1 }, { rotulo: 'centímetros', mm: 10 }, { rotulo: 'polegadas', mm: 25.4 }] as const

/** Lê o $INSUNITS do cabeçalho do DXF (código 70 logo depois). null = não informado (perguntar). */
export function unidadeDoDxf(texto: string): { codigo: number; mmPorUnidade: number } | null {
  const L = texto.split(/\r\n|\r|\n/)
  for (let i = 0; i + 3 < L.length; i++) {
    if (L[i].trim() === '$INSUNITS') {
      const codigo = parseInt(L[i + 2], 10)
      const mm = MM_POR_UNIDADE_DXF[codigo]
      return mm ? { codigo, mmPorUnidade: mm } : null
    }
    if (L[i].trim() === 'ENTITIES') break
  }
  return null
}
