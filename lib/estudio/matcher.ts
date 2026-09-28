// SOA Design — FILE MATCHER de PRODUTO (determinístico; IA só como fallback futuro): em um lote com produtos
// misturados, descobre para qual MOCKUP vai cada arquivo pelo nome + apelidos + pasta + histórico (+ proporção como
// desempate), com um índice de confiança. Baixa confiança ou empate → vira exceção na conferência.
import { normalizar } from './vinculo'

export interface ProdutoMatch { id: string; nome: string; apelidos?: string[]; /** largura/altura da face principal (desempate) */ proporcao?: number | null }
export interface ResultadoProduto { mockupId: string | null; confianca: number; motivo: string; empate?: string[] }

/** Palavras que não identificam o produto sozinhas. */
const GENERICAS = new Set(['caixa', 'cx', 'mockup', 'kit', 'arte', 'artes', 'modelo', 'produto', 'personalizado', 'personalizada', 'final', 'de', 'da', 'do', 'com', 'e', 'lisa', 'liso', 'copia'])
const SINONIMOS: Record<string, string> = { cx: 'caixa', sac: 'sacola', sacolinha: 'sacola', cxa: 'caixa' }
const toks = (s: string) => normalizar(s).split(' ').filter(Boolean).map(t => SINONIMOS[t] || t)
const contem = (h: string[], a: string[]) => { if (!a.length) return -1; for (let i = 0; i + a.length <= h.length; i++) if (a.every((x, k) => h[i + k] === x)) return i; return -1 }

/** Histórico de correções (por navegador): "arquivo começando com X foi para o mockup Y". */
const CHAVE_HIST = 'soa:matcher:historico'
export function lerHistorico(): Record<string, string> { try { return JSON.parse(localStorage.getItem(CHAVE_HIST) || '{}') } catch { return {} } }
export function lembrarCorrecao(caminho: string, mockupId: string) {
  try {
    const h = lerHistorico(), t = toks(caminho.split('/').pop() || caminho)
    const prefixo = t.slice(0, 2).join(' ')
    if (prefixo) { h[prefixo] = mockupId; localStorage.setItem(CHAVE_HIST, JSON.stringify(h)) }
  } catch { /* sem localStorage: só não lembra */ }
}

/**
 * Pontuação por mockup (0…1):
 *  1,00 nome completo do mockup no nome do arquivo (ex.: "sacola_p_sereia" → "Sacola P")
 *  0,95 apelido cadastrado por ela (ex.: "cx_milk" → Milk)
 *  0,90 histórico (ela já corrigiu um arquivo com o mesmo começo)
 *  0,80 palavra distintiva do nome (ex.: "milk")          +0,05 se veio da PASTA
 *  empate (diferença < 0,05) ou < 0,7 → exceção
 */
export function casarProduto(caminho: string, produtos: ProdutoMatch[], opc: { historico?: Record<string, string>; proporcaoArte?: number | null } = {}): ResultadoProduto {
  if (produtos.length === 1) return { mockupId: produtos[0].id, confianca: 1, motivo: 'mockup escolhido para o lote' }
  const partes = caminho.split('/'), arquivo = partes.pop() || '', pastas = partes.join(' ')
  const ta = toks(arquivo), tp = toks(pastas), todos = [...tp, ...ta]
  const notas: { id: string; s: number; motivo: string }[] = []
  const hist = opc.historico || {}
  const hPref = ta.slice(0, 2).join(' ')
  for (const p of produtos) {
    const nome = toks(p.nome)
    let s = 0, motivo = ''
    const emArq = contem(ta, nome) >= 0, emPasta = contem(tp, nome) >= 0
    if (nome.length && (emArq || emPasta)) { s = 1; motivo = `nome “${p.nome}”${emPasta && !emArq ? ' (pasta)' : ''}` }
    for (const ap of p.apelidos || []) { const a = toks(ap); if (a.length && contem(todos, a) >= 0 && s < 0.95) { s = 0.95; motivo = `apelido “${ap}”` } }
    if (s < 0.9 && hPref && hist[hPref] === p.id) { s = 0.9; motivo = 'você já ligou arquivos assim a este mockup' }
    if (s < 0.8) {
      const distintas = nome.filter(t => !GENERICAS.has(t) && t.length > 1)
      const hitArq = distintas.find(t => ta.includes(t)), hitPasta = distintas.find(t => tp.includes(t))
      if (hitArq || hitPasta) { s = 0.8 + (hitPasta && !hitArq ? 0.05 : 0); motivo = `palavra “${hitArq || hitPasta}”` }
    }
    // desempate fraco: proporção da arte parecida com a da face principal
    if (s > 0 && opc.proporcaoArte && p.proporcao) s += 0.03 * Math.max(0, 1 - Math.abs(Math.log(opc.proporcaoArte / p.proporcao)))
    if (s > 0) notas.push({ id: p.id, s: Math.min(1, s), motivo })
  }
  if (!notas.length) return { mockupId: null, confianca: 0, motivo: 'nenhum mockup no nome do arquivo' }
  notas.sort((a, b) => b.s - a.s)
  const empate = notas.filter(n => notas[0].s - n.s < 0.05)
  if (empate.length > 1) return { mockupId: notas[0].id, confianca: 0.5, motivo: `pode ser ${empate.length} mockups`, empate: empate.map(n => n.id) }
  return { mockupId: notas[0].id, confianca: notas[0].s, motivo: notas[0].motivo }
}

/** Palavras do produto (nome + apelidos) — tiradas do nome do arquivo para sobrar o TEMA. */
export const palavrasDoProduto = (p: ProdutoMatch) => [p.nome, ...(p.apelidos || [])].join(' ')

/** Hash rápido (cyrb53) de um texto — chave do cache. */
export function hashTexto(s: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < s.length; i++) { const ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677) }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}
/** Hash do CONTEÚDO do arquivo (SHA-256) — a mesma arte com outro nome não re-renderiza. */
export async function hashArquivo(f: Blob): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', await f.arrayBuffer())
  return [...new Uint8Array(d)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('')
}
