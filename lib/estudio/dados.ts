// SOA Edition — fonte de dados do lote: colar lista, planilha, pedido; mapeamento de colunas
// para variáveis; variações combinadas (produto cartesiano com teto); regra de nome.
import type { Linha } from './tipos'

export interface Tabela { cabecalhos: string[]; linhas: string[][] }

/** Máximo de artes por EXECUÇÃO — acima disso a artesã gera em levas (a cota diária é à parte). */
export const LIMITE_LOTE = 50
/** Teto da LISTA montada (linhas × variações) — só para a combinação não explodir o navegador. */
export const LIMITE_LISTA = 1000

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

/** Colar: 1 item por linha; colunas separadas por TAB (colado do Excel) ou ";". */
export function tabelaDeColar(texto: string, primeiraEhCabecalho: boolean): Tabela {
  const brutas = texto.replace(/\r/g, '').split('\n').map(l => l.trimEnd()).filter(l => l.trim())
  if (!brutas.length) return { cabecalhos: [], linhas: [] }
  const sep = brutas.some(l => l.includes('\t')) ? '\t' : brutas.some(l => l.includes(';')) ? ';' : null
  const partes = brutas.map(l => (sep ? l.split(sep) : [l]).map(c => c.trim()))
  const nCols = Math.max(...partes.map(p => p.length))
  if (primeiraEhCabecalho && partes.length > 1) {
    const cab = partes[0].map((c, i) => c || `Coluna ${i + 1}`)
    while (cab.length < nCols) cab.push(`Coluna ${cab.length + 1}`)
    return { cabecalhos: cab, linhas: partes.slice(1) }
  }
  return { cabecalhos: Array.from({ length: nCols }, (_, i) => (nCols === 1 ? 'Lista' : `Coluna ${i + 1}`)), linhas: partes }
}

/** Planilha já lida (array de arrays, 1ª linha = cabeçalho). */
export function tabelaDePlanilha(aoa: unknown[][]): Tabela {
  const rows = aoa.filter(r => Array.isArray(r) && r.some(c => String(c ?? '').trim()))
  if (!rows.length) return { cabecalhos: [], linhas: [] }
  const nCols = Math.max(...rows.map(r => r.length))
  const cab = Array.from({ length: nCols }, (_, i) => String(rows[0][i] ?? '').trim() || `Coluna ${i + 1}`)
  return { cabecalhos: cab, linhas: rows.slice(1).map(r => Array.from({ length: nCols }, (_, i) => String(r[i] ?? '').trim())) }
}

export interface PedidoFonte {
  id: string; numero: string | null; destinatario: string | null; produto: string | null
  quantidade: number; dataEnvio: string | null; campos: Record<string, string>
}

/**
 * Pedidos → tabela. Cada pedido vira uma linha (campos-base + campos personalizados).
 * `expandirCampo`: se preenchido, cada item daquele campo (separado por quebra de linha ou ";")
 * vira uma linha — é o caso "o pedido já traz a lista de nomes".
 */
export function tabelaDePedidos(pedidos: PedidoFonte[], expandirCampo: string | null): Tabela & { pedidoIds: string[] } {
  const nomesCampos: string[] = []
  for (const p of pedidos) for (const k of Object.keys(p.campos)) if (!nomesCampos.includes(k)) nomesCampos.push(k)
  const cabecalhos = ['Pedido', 'Cliente', 'Produto', 'Quantidade', 'Data de envio', ...nomesCampos]
  const linhas: string[][] = []
  const pedidoIds: string[] = []
  for (const p of pedidos) {
    const base = [p.numero || '', p.destinatario || '', p.produto || '', String(p.quantidade || 1), p.dataEnvio || '', ...nomesCampos.map(k => p.campos[k] || '')]
    const idx = expandirCampo ? cabecalhos.indexOf(expandirCampo) : -1
    const itens = idx >= 0 ? base[idx].split(/\n|;/).map(s => s.trim()).filter(Boolean) : []
    if (itens.length > 1) for (const it of itens) { const l = [...base]; l[idx] = it; linhas.push(l); pedidoIds.push(p.id) }
    else { linhas.push(base); pedidoIds.push(p.id) }
  }
  return { cabecalhos, linhas, pedidoIds }
}

/** Sugere, para cada variável do template, a coluna mais parecida (ex.: nome → "Nome da Criança"). */
export function mapearAuto(variaveis: string[], cabecalhos: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const v of variaveis) {
    const nv = norm(v)
    const exata = cabecalhos.find(c => norm(c) === nv)
    const contem = cabecalhos.find(c => norm(c).includes(nv) || (nv.length > 2 && nv.includes(norm(c)) && norm(c).length > 2))
    const escolhida = exata || contem || (cabecalhos.length === 1 ? cabecalhos[0] : '')
    if (escolhida) out[v] = escolhida
  }
  return out
}

export interface Variacao { variavel: string; valores: string[] }

/** Linhas finais = cada linha × cada combinação das variações (limitado a LIMITE_LISTA). A geração
 *  anda em levas de LIMITE_LOTE — ver levas(). */
export function montarLinhas(tab: Tabela, mapa: Record<string, string>, variacoes: Variacao[]): { linhas: Linha[]; cortado: boolean } {
  const base: Linha[] = tab.linhas.map(r => {
    const o: Linha = {}
    tab.cabecalhos.forEach((c, i) => { o[c] = r[i] ?? '' })
    for (const [v, col] of Object.entries(mapa)) if (col) o[v] = o[col] ?? ''
    return o
  })
  const ativas = variacoes.filter(v => v.variavel.trim() && v.valores.length)
  let linhas: Linha[] = base.length ? base : [{}]
  let cortado = false
  for (const va of ativas) {
    const prox: Linha[] = []
    for (const l of linhas) for (const val of va.valores) {
      if (prox.length >= LIMITE_LISTA) { cortado = true; break }
      prox.push({ ...l, [va.variavel.trim()]: val })
    }
    linhas = prox
  }
  if (linhas.length > LIMITE_LISTA) { linhas = linhas.slice(0, LIMITE_LISTA); cortado = true }
  return { linhas: base.length || ativas.length ? linhas : [], cortado }
}

/** Divide a lista em levas de LIMITE_LOTE (1–50, 51–100…). */
export function levas(total: number): { inicio: number; fim: number }[] {
  const out: { inicio: number; fim: number }[] = []
  for (let i = 0; i < total; i += LIMITE_LOTE) out.push({ inicio: i, fim: Math.min(total, i + LIMITE_LOTE) })
  return out
}

/** Nome de arquivo pela regra ("{pedido}_{nome}"), seguro para Windows/macOS e sem repetir. */
export function nomesArquivos(regra: string, linhas: Linha[], ext: string): string[] {
  const usados = new Map<string, number>()
  return linhas.map((l, i) => {
    const ctx: Linha = { ...l, n: String(i + 1), pedido: l.pedido ?? l.Pedido ?? '' }
    let base = (regra || '{n}').replace(/\{([^{}]+)\}/g, (_, k) => ctx[String(k).trim()] ?? '')
    base = base.normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').replace(/^[_\-. ]+|[_\-. ]+$/g, '').trim()
    if (!base) base = String(i + 1).padStart(3, '0')
    base = base.slice(0, 120)
    const q = usados.get(base) || 0
    usados.set(base, q + 1)
    return `${q ? `${base}-${q + 1}` : base}.${ext}`
  })
}
