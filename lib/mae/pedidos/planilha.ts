// mae-pedidos — PLANILHA DE PEDIDOS da Shopee para o MAE avulso (Lote 7, item 121). Puro (a leitura do .xlsx fica
// na tela, com a lib `xlsx`):
//  • MAPEAR COLUNAS: sugestão pelo cabeçalho da Shopee (os mesmos nomes da importação do SOA); o mapeamento
//    escolhido fica lembrado na Biblioteca (Pedidos/mapeamento-planilha.json);
//  • linhas → pedidos: as linhas com o mesmo nº viram UM pedido com vários itens; "Variação,10" = 10 peças;
//  • personalização: TEMA, NOME e IDADE lidos da observação do comprador quando é seguro — senão ficam para
//    completar na lista (a observação aparece no 💬).
import { separarNomeIdade } from './pedidos'

export const CAMPOS_PLANILHA = ['numero', 'produto', 'variacao', 'quantidade', 'dataEnvio', 'observacao', 'cliente'] as const
export type CampoPlanilha = (typeof CAMPOS_PLANILHA)[number]
export type Mapeamento = Partial<Record<CampoPlanilha, string>>
export const ROTULO_CAMPO: Record<CampoPlanilha, string> = {
  numero: 'Nº do pedido', produto: 'Produto', variacao: 'Variação', quantidade: 'Quantidade', dataEnvio: 'Prazo de envio', observacao: 'Observação do comprador', cliente: 'Nome do cliente',
}
export const OBRIGATORIOS: CampoPlanilha[] = ['numero', 'produto']
/** Cabeçalhos da planilha de pedidos da Shopee (os mesmos que a importação do SOA reconhece). */
const SHOPEE: Record<CampoPlanilha, string[]> = {
  numero: ['ID do pedido'],
  produto: ['Nome do Produto'],
  variacao: ['Nome da variação', 'Nome da Variação', 'Variação', 'Variacao'],
  quantidade: ['Quantidade', 'Quantidade do Produto', 'Quantidade do produto', 'Qtd', 'Qtde'],
  dataEnvio: ['Data prevista de envio'],
  observacao: ['Observação do comprador'],
  cliente: ['Nome do destinatário', 'Nome de usuário (comprador)'],
}
export const ARQ_MAPEAMENTO = 'Pedidos/mapeamento-planilha.json'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Mapeamento sugerido: o salvo (se as colunas ainda existem) → o da Shopee → nome parecido. */
export function sugerirMapeamento(cabecalhos: string[], salvo?: Mapeamento | null): Mapeamento {
  const out: Mapeamento = {}
  const achar = (nomes: string[]) => cabecalhos.find(h => nomes.some(n => norm(n) === norm(h)))
  for (const c of CAMPOS_PLANILHA) {
    const s = salvo?.[c]
    out[c] = (s && cabecalhos.includes(s) ? s : undefined) ?? achar(SHOPEE[c]) ?? achar([ROTULO_CAMPO[c]])
    if (!out[c]) delete out[c]
  }
  return out
}
export const mapeamentoCompleto = (m: Mapeamento) => OBRIGATORIOS.every(c => !!m[c])

/** Data da planilha → AAAA-MM-DD: "2026-10-11 14:30", "11/10/2026", nº de série do Excel. Inválida → null. */
export function dataDaPlanilha(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400000))
    return d.toISOString().slice(0, 10)
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10)
  const s = String(v).trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

/** Personalização na observação: "Tema: Moana" e "Ana 5 anos". Só preenche quando é seguro (senão, revisar). */
export function personalizacaoDaObs(obs: string): { TEMA?: string; NOME?: string; IDADE?: string } {
  const out: { TEMA?: string; NOME?: string; IDADE?: string } = {}
  let t = String(obs ?? '')
  const tema = /\btema\s*[:\-–]?\s*([^,;.\n|]{2,60})/i.exec(t)
  if (tema) { out.TEMA = tema[1].trim().replace(/[.\s]+$/, ''); t = t.replace(tema[0], ' ') }
  const r = separarNomeIdade(t)
  if (!r.revisar && r.nome && r.nome.split(/\s+/).length <= 4) { out.NOME = r.nome; if (r.idade) out.IDADE = r.idade }
  return out
}

export interface PedidoDaPlanilha {
  origem: 'shopee'; numero: string; cliente: string | null; canal: string
  itens: { nome: string; variacao: string | null; quantidade: number }[]
  dataEnvio: string | null; observacao: string | null; campos: Record<string, string>
}

/** Linhas da planilha (objetos cabeçalho → valor) → pedidos (um por nº, com os itens juntos). */
export function pedidosDaPlanilha(linhas: Record<string, unknown>[], m: Mapeamento): { pedidos: PedidoDaPlanilha[]; ignoradas: number } {
  const col = (l: Record<string, unknown>, c: CampoPlanilha) => (m[c] ? String(l[m[c]!] ?? '').trim() : '')
  const porNumero = new Map<string, PedidoDaPlanilha>()
  let ignoradas = 0
  for (const l of linhas) {
    const numero = col(l, 'numero'), produto = col(l, 'produto')
    if (!numero || !produto) { ignoradas++; continue }
    // "Amarelo_completo,10" → 10 peças, variação "Amarelo_completo" (mesma regra da importação do SOA)
    let variacao = col(l, 'variacao') || null, qtd = parseInt(col(l, 'quantidade')) || 1
    const suf = variacao ? /,(\d+)$/.exec(variacao) : null
    if (suf && Number(suf[1]) > 0) { qtd = Number(suf[1]); variacao = variacao!.slice(0, -suf[0].length).trim() || null }
    const p = porNumero.get(numero) ?? {
      origem: 'shopee' as const, numero, cliente: col(l, 'cliente') || null, canal: 'Shopee', itens: [],
      dataEnvio: m.dataEnvio ? dataDaPlanilha(l[m.dataEnvio]) : null, observacao: col(l, 'observacao') || null, campos: {},
    }
    p.itens.push({ nome: produto, variacao, quantidade: qtd })
    if (!p.observacao && col(l, 'observacao')) p.observacao = col(l, 'observacao')
    porNumero.set(numero, p)
  }
  const pedidos = [...porNumero.values()].map(p => ({ ...p, campos: p.observacao ? personalizacaoDaObs(p.observacao) as Record<string, string> : {} }))
  return { pedidos, ignoradas }
}
