// SOA Design — caminhos de pasta de "Meus arquivos" ("Moldes/Caixa milk"). Mesma regra no servidor e no navegador.

/** Normaliza um caminho: sem barras nas pontas/duplas, cada parte aparada (≤ 60), até 8 níveis, ≤ 200 caracteres. */
export function normalizarCaminho(c: unknown): string {
  if (typeof c !== 'string') return ''
  const partes = c.split('/').map(p => p.replace(/\s+/g, ' ').trim().slice(0, 60)).filter(Boolean).slice(0, 8)
  return partes.join('/').slice(0, 200)
}
/** Pasta-mãe ("" = raiz). */
export const paiDe = (c: string) => (c.includes('/') ? c.slice(0, c.lastIndexOf('/')) : '')
/** Último pedaço (nome da pasta). */
export const nomeDe = (c: string) => c.slice(c.lastIndexOf('/') + 1)
/** `c` está dentro de `pasta` (ou é ela)? */
export const dentroDe = (c: string, pasta: string) => !pasta || c === pasta || c.startsWith(pasta + '/')
/** Todas as pastas-ancestrais de um caminho (a própria inclusa): "a/b/c" → ["a", "a/b", "a/b/c"]. */
export const ancestrais = (c: string) => c.split('/').map((_, i, p) => p.slice(0, i + 1).join('/'))
