// Lote 6 (item 113): UNIDADES — mm, cm ou px (px sempre a 300 dpi, a resolução da impressão). A receita guarda
// SEMPRE mm; a unidade escolhida (engrenagem) só muda o que aparece na régua, nos painéis e nos campos. Qualquer
// campo aceita o valor com unidade ("9cm" num campo em mm vira 90 mm). Puro.

export type Unidade = 'mm' | 'cm' | 'px'
export const DPI_PX = 300
const MM_POR: Record<string, number> = { mm: 1, cm: 10, m: 1000, in: 25.4, pol: 25.4, '"': 25.4, pt: 25.4 / 72, px: 25.4 / DPI_PX }

/** "9cm", "9 cm", "90", "3,5 mm", "1in", "354px" → mm. Sem unidade = `padrao`. Inválido → null. */
export function lerMedidaMm(v: string | number | null | undefined, padrao: Unidade = 'mm'): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v * MM_POR[padrao] : null
  const m = /^\s*([+-]?(?:\d+[.,]?\d*|[.,]\d+))\s*(mm|cm|m|in|pol|"|pt|px)?\s*$/i.exec(String(v ?? ''))
  if (!m) return null
  const n = parseFloat(m[1].replace(',', '.'))
  if (!Number.isFinite(n)) return null
  return Math.round(n * MM_POR[(m[2] || padrao).toLowerCase()] * 1000) / 1000
}

/** mm → número na unidade escolhida. */
export const emUnidade = (mm: number, u: Unidade) => (u === 'cm' ? mm / 10 : u === 'px' ? (mm * DPI_PX) / 25.4 : mm)
/** número na unidade → mm. */
export const deUnidade = (v: number, u: Unidade) => (u === 'cm' ? v * 10 : u === 'px' ? (v * 25.4) / DPI_PX : v)
/** Rótulo da unidade ("px a 300 dpi" para não confundir com o pixel da tela). */
export const rotuloUnidade = (u: Unidade) => (u === 'px' ? 'px a 300 dpi' : u)
/** Casas decimais boas para mostrar na unidade. */
export const casasDa = (u: Unidade) => (u === 'cm' ? 2 : u === 'px' ? 0 : 1)
