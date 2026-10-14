// mae-exportar — Lote 14 (itens 199, 200, 201): a TELA ÚNICA "Gerar" — as escolhas, o resumo "Vai gerar N arquivos"
// (antes de clicar, sem surpresa) e a chave de "a mesma caixa junta" (a marca de registro da prancheta). Puro.

export interface EscolhasGerar {
  /** Um PDF por pedido (nome do cliente, pasta Pedidos) × juntar os pedidos num lote (pasta LOTES). */
  modo: 'pedido' | 'lote'
  /** Lote: um PDF por tipo de produto (Pegue e Monte num, Tags noutro). Desligado: tudo num PDF só. */
  porProduto: boolean
  /** Lote: até N pedidos por PDF. */
  maxPedidos: number
  /** Lote: a mesma caixa junta (para cortar em sequência) × o kit de cada cliente junto. */
  ordem: 'modelo' | 'pedido'
  intercalar: boolean
  /** Na folha. */
  identificacao: boolean
  fundoMarca: boolean
  folgaMarcaMm: number
  linhas: boolean
  apliques: boolean
  /** Folhas incompletas (tags, etiquetas) completadas com outros pedidos — só no lote. */
  aproveitar: boolean
  /** Depois de gerar. */
  iniciarImpressao: boolean
  /** Avançado. */
  quantidade: 'pedido' | 'um'
  folhaSeparada: boolean
  cortePorPedido: boolean
}

export const ESCOLHAS_PADRAO: EscolhasGerar = {
  modo: 'pedido', porProduto: true, maxPedidos: 10, ordem: 'modelo', intercalar: true,
  identificacao: true, fundoMarca: true, folgaMarcaMm: 1, linhas: false, apliques: true, aproveitar: false,
  iniciarImpressao: true, quantidade: 'pedido', folhaSeparada: false, cortePorPedido: false,
}

/** Junta o que veio guardado (de uma versão antiga, ou mexido à mão) com o padrão, só com valores válidos. */
export function escolhasValidas(x: unknown): EscolhasGerar {
  const o = (x && typeof x === 'object' ? x : {}) as Partial<Record<keyof EscolhasGerar, unknown>>
  const e: EscolhasGerar = { ...ESCOLHAS_PADRAO }
  for (const k of Object.keys(ESCOLHAS_PADRAO) as (keyof EscolhasGerar)[]) {
    const v = o[k], p = ESCOLHAS_PADRAO[k]
    if (typeof v === typeof p) (e as unknown as Record<string, unknown>)[k] = v
  }
  if (e.modo !== 'pedido' && e.modo !== 'lote') e.modo = 'pedido'
  if (e.ordem !== 'modelo' && e.ordem !== 'pedido') e.ordem = 'modelo'
  if (e.quantidade !== 'pedido' && e.quantidade !== 'um') e.quantidade = 'pedido'
  e.maxPedidos = Math.max(1, Math.min(50, Math.round(e.maxPedidos) || 10))
  e.folgaMarcaMm = Math.max(0, Math.min(10, e.folgaMarcaMm))
  return e
}

export interface ItemPlano { pedido: string; produto: string }
export interface LinhaPlano { produto: string; pedidos: number; pdfs: number }

/**
 * "Vai gerar N arquivos": por pedido = um PDF para cada pedido e produto; no lote = os pedidos de cada produto (ou
 * todos juntos) em PDFs de até N pedidos.
 */
export function planejarGeracao(itens: ItemPlano[], e: Pick<EscolhasGerar, 'modo' | 'porProduto' | 'maxPedidos'>): { arquivos: number; linhas: LinhaPlano[] } {
  const grupos = new Map<string, { pedidos: Set<string>; itens: number }>()
  for (const it of itens) {
    const k = e.modo === 'pedido' || e.porProduto ? (it.produto.trim() || 'Outros') : 'Todos os produtos'
    const g = grupos.get(k) ?? { pedidos: new Set<string>(), itens: 0 }
    g.pedidos.add(it.pedido); g.itens++
    grupos.set(k, g)
  }
  const max = Math.max(1, Math.round(e.maxPedidos) || 10)
  const linhas = [...grupos].map(([produto, g]) => ({ produto, pedidos: g.pedidos.size, pdfs: e.modo === 'pedido' ? g.itens : Math.ceil(g.pedidos.size / max) }))
  return { arquivos: linhas.reduce((s, l) => s + l.pdfs, 0), linhas }
}

/** Nome comparável de caixa: sem acento, maiúsculas, "_molde", "_MR", "marca (de) registro". PIRAMIDE = PIRÂMIDE. */
export function nomeDeCaixa(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/marca\s*(de\s*)?registro/g, ' ').replace(/(^|[\s_-])(molde|mr)(?=$|[\s_-])/g, ' ')
    .replace(/[^a-z0-9]+/g, '')
}

/**
 * Lote 14 (item 200): a chave de "a mesma caixa junta" — a MARCA DE REGISTRO da prancheta (mesma marca = mesmo molde
 * de corte = mesma caixa, seja qual for o nome em cada base); sem marca, o "Mesma caixa que…" ou o nome comparável.
 */
export function chaveDaCaixa(ab: { registrationPresetId?: string; registrationPresetSha?: string; mesmaCaixa?: string; name?: string }, nomeDosMoldes = ''): string {
  if (ab.registrationPresetSha || ab.registrationPresetId) return `mr:${ab.registrationPresetSha ?? ab.registrationPresetId}`
  return `n:${nomeDeCaixa(ab.mesmaCaixa || nomeDosMoldes || ab.name || '')}`
}
