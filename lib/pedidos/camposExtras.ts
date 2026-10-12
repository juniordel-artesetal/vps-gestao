// "Order".camposExtras — gravação que NÃO perde dados internos (MAE Lote 8, item 127).
//
// A tela do pedido do SOA monta o formulário só com os campos visíveis e descarta as chaves internas (as que começam com
// "_", exceto as que ela mesma manda, como _freelancers). Como a rota regravava o camposExtras INTEIRO, salvar o pedido
// no SOA apagava o "_mae" (tema escolhido no Método Mãe, posições/tamanhos ajustados só no pedido, quantidades…).
// Aqui: as chaves internas que já estavam no pedido e que o formulário NÃO mandou são preservadas. Puro.

export function lerExtrasJson(x: unknown): Record<string, unknown> | null {
  if (x === null || x === undefined || x === '') return null
  if (typeof x === 'string') { try { const j = JSON.parse(x); return j && typeof j === 'object' && !Array.isArray(j) ? j : null } catch { return null } }
  return typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : null
}

/** Novo camposExtras (objeto ou string JSON) + as chaves internas ("_…") do atual que o novo não trouxe. */
export function mesclarInternos(novo: unknown, atual: unknown): unknown {
  const n = lerExtrasJson(novo), a = lerExtrasJson(atual)
  if (!n || !a) return novo
  const faltando = Object.keys(a).filter(k => k.startsWith('_') && !(k in n))
  if (!faltando.length) return novo
  const out: Record<string, unknown> = { ...n }
  for (const k of faltando) out[k] = a[k]
  return typeof novo === 'string' ? JSON.stringify(out) : out
}
