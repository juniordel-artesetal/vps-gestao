// mae-render — IMPRESSÃO DIGITAL da receita: JSON canônico (chaves em ordem) → SHA-256.
// Mesma receita + mesma resolução = mesmo hash; é com ele que a tela diz "idêntico ✓" ao comparar
// duas exportações da mesma arte.

/** JSON com as chaves dos objetos em ordem alfabética (independe da ordem em que foram criadas). */
export function jsonCanonico(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null'
  if (Array.isArray(v)) return `[${v.map(jsonCanonico).join(',')}]`
  const o = v as Record<string, unknown>
  return `{${Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${jsonCanonico(o[k])}`).join(',')}}`
}

export async function hashTexto(texto: string): Promise<string> {
  const dig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return Array.from(new Uint8Array(dig), b => b.toString(16).padStart(2, '0')).join('')
}

/** Hash da receita de render: prancheta + resolução + fundo. */
export function hashReceita(receita: { prancheta: unknown; pxPorMm: number; fundo: string | null }): Promise<string> {
  return hashTexto(jsonCanonico(receita))
}
