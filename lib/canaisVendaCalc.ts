// Cálculo PURO de taxas de canal (sem prisma) — FONTE ÚNICA importável no CLIENT.
// Usado pela precificação de produto (page), pelo simulador e pelo Resultado, além do
// resolver do servidor (lib/canaisVenda.ts). Assim a taxa nunca diverge entre telas.

// Uma regra de taxa. A condição é opcional: sem condição = vale sempre (flat).
export interface RegraTaxa {
  precoAte?: number | null   // faixa de preço: aplica se preço <= precoAte (null = sem teto)
  categoria?: string | null  // categoria do anúncio (ML/Amazon)
  variante?: string | null   // 'classico' | 'premium' (ML)
  taxaPercent: number
  taxaFixa: number
  label?: string
}

export interface TaxaEfetiva {
  canal: string; nome: string
  taxaPercent: number; taxaFixa: number
  pixDias: number; cartaoDias: number
  origem: 'gerenciado' | 'custom' | 'catalogo' | 'nenhum'
  atualizadoEm: string | null
  ajustado?: boolean
}

export interface ModeloCatalogo {
  canal: string; nome: string
  regras: RegraTaxa[]
  categorias?: string[]; variantes?: string[]
  pixDias: number; cartaoDias: number
  estrutura: string
}

export interface CanalCatalogoRow { canal: string; nome: string; regras: RegraTaxa[]; categorias: string[]; variantes: string[]; pixDias: number; cartaoDias: number; estrutura: string | null; atualizadoEm: string | null; atualizadoPor: string | null }

export interface CanalVendaRow {
  canal: string; nome: string; origem: string
  categoria: string | null; variante: string | null
  overridePercent: number | null; overrideFixa: number | null
  taxaPercent: number; taxaFixa: number; pixDias: number; cartaoDias: number
}

// ─── SEED do catálogo gerenciado (números da pesquisa jul/2026 — SUGESTÕES) ───
export const CATALOGO_SEED: ModeloCatalogo[] = [
  {
    canal: 'shopee', nome: 'Shopee', pixDias: 14, cartaoDias: 14,
    estrutura: 'Comissão por faixa de preço do item + taxa fixa (frete grátis obrigatório desde 03/2026).',
    regras: [
      { precoAte: 79.99, taxaPercent: 20, taxaFixa: 4, label: 'Até R$79,99' },
      { precoAte: 99.99, taxaPercent: 14, taxaFixa: 16, label: 'R$80–99,99' },
      { precoAte: 199.99, taxaPercent: 14, taxaFixa: 20, label: 'R$100–199,99' },
      { precoAte: null, taxaPercent: 14, taxaFixa: 26, label: 'Acima de R$200' },
    ],
  },
  {
    canal: 'tiktokshop', nome: 'TikTok Shop', pixDias: 14, cartaoDias: 14,
    estrutura: 'Comissão por faixa de preço (vigente 15/07/2026). Novos vendedores costumam ter isenção nos ~60 primeiros dias.',
    regras: [
      { precoAte: 49.99, taxaPercent: 10, taxaFixa: 0, label: 'Abaixo de R$50' },
      { precoAte: null, taxaPercent: 6, taxaFixa: 6, label: 'R$50 ou mais' },
    ],
  },
  {
    canal: 'mercadolivre', nome: 'Mercado Livre', pixDias: 14, cartaoDias: 14,
    categorias: ['geral', 'roupa', 'beleza', 'casa', 'esporte'], variantes: ['classico', 'premium'],
    estrutura: 'Comissão por categoria e tipo de anúncio (Clássico/Premium ~+5pp) + custo fixo ~R$6 em itens de baixo valor. Confira no simulador oficial da sua categoria.',
    regras: [
      { categoria: 'roupa', variante: 'classico', taxaPercent: 14, taxaFixa: 6 }, { categoria: 'roupa', variante: 'premium', taxaPercent: 19, taxaFixa: 6 },
      { categoria: 'beleza', variante: 'classico', taxaPercent: 13, taxaFixa: 6 }, { categoria: 'beleza', variante: 'premium', taxaPercent: 18, taxaFixa: 6 },
      { categoria: 'casa', variante: 'classico', taxaPercent: 12, taxaFixa: 6 }, { categoria: 'casa', variante: 'premium', taxaPercent: 17, taxaFixa: 6 },
      { categoria: 'esporte', variante: 'classico', taxaPercent: 12, taxaFixa: 6 }, { categoria: 'esporte', variante: 'premium', taxaPercent: 17, taxaFixa: 6 },
      { categoria: 'geral', variante: 'classico', taxaPercent: 13, taxaFixa: 6 }, { categoria: 'geral', variante: 'premium', taxaPercent: 18, taxaFixa: 6 },
      { categoria: null, variante: 'premium', taxaPercent: 18, taxaFixa: 6 }, { categoria: null, variante: 'classico', taxaPercent: 13, taxaFixa: 6 },
    ],
  },
  {
    canal: 'amazon', nome: 'Amazon', pixDias: 14, cartaoDias: 14,
    categorias: ['geral', 'roupa', 'casa'],
    estrutura: 'Comissão por categoria (10–15%) + R$2/item (plano Individual). Plano Profissional: R$19/mês sem os R$2 (vale acima de ~10 vendas/mês).',
    regras: [
      { categoria: 'roupa', taxaPercent: 15, taxaFixa: 2 },
      { categoria: 'casa', taxaPercent: 12, taxaFixa: 2 },
      { categoria: 'geral', taxaPercent: 12, taxaFixa: 2 },
      { categoria: null, taxaPercent: 13, taxaFixa: 2 },
    ],
  },
]

export function avisoResponsabilidade(): string {
  return 'Confira as taxas com a sua plataforma — as políticas mudam. Você é responsável por manter esses números.'
}

// Normaliza rótulos/variações para o slug canônico. O pedido guarda o canal como
// rótulo ('Mercado Livre'); a precificação usa slug ('ml'). Aqui casamos.
export function normalizarCanal(s: string | null | undefined): string {
  const t = String(s || '').trim().toLowerCase()
  const mapa: Record<string, string> = {
    'ml': 'mercadolivre', 'mercado livre': 'mercadolivre', 'mercadolivre': 'mercadolivre',
    'shopee': 'shopee', 'elo7': 'elo7', 'amazon': 'amazon',
    'tiktok': 'tiktokshop', 'tiktok shop': 'tiktokshop', 'tiktokshop': 'tiktokshop',
    'magalu': 'magalu', 'magazine luiza': 'magalu',
    'site': 'site', 'site próprio': 'site', 'site proprio': 'site', 'loja': 'site', 'loja própria': 'site',
    'direta': 'direta', 'venda direta': 'direta',
    'instagram': 'instagram', 'insta': 'instagram', 'whatsapp': 'whatsapp', 'whats': 'whatsapp', 'zap': 'whatsapp',
  }
  return mapa[t] || t
}

export function modeloCatalogo(canal: string): ModeloCatalogo | null {
  const slug = normalizarCanal(canal)
  return CATALOGO_SEED.find(c => c.canal === slug) || null
}

export function parseRegras(raw: unknown): RegraTaxa[] {
  if (Array.isArray(raw)) return raw as RegraTaxa[]
  if (typeof raw === 'string') { try { const a = JSON.parse(raw); return Array.isArray(a) ? a : [] } catch { return [] } }
  return []
}

/** Escolhe a regra que se aplica a (preço, categoria, variante): a mais específica e
 *  a faixa mais justa. Cai para regras genéricas quando não há match de categoria. */
export function escolherRegra(regras: RegraTaxa[], ctx: { preco?: number; categoria?: string | null; variante?: string | null }): RegraTaxa {
  const preco = Math.max(0, Number(ctx.preco) || 0)
  const cat = ctx.categoria ? String(ctx.categoria).toLowerCase() : null
  const varr = ctx.variante ? String(ctx.variante).toLowerCase() : null
  const casaFaixa = (r: RegraTaxa) => r.precoAte == null || preco <= Number(r.precoAte) + 0.005
  const casaTudo = (r: RegraTaxa) =>
    (r.categoria == null || String(r.categoria).toLowerCase() === cat) &&
    (r.variante == null || String(r.variante).toLowerCase() === varr) && casaFaixa(r)
  let cand = regras.filter(casaTudo)
  if (!cand.length) cand = regras.filter(r => r.categoria == null && r.variante == null && casaFaixa(r))
  if (!cand.length) cand = regras.slice()
  const espec = (r: RegraTaxa) => (r.categoria ? 1 : 0) + (r.variante ? 1 : 0)
  cand.sort((a, b) => espec(b) - espec(a) || (a.precoAte ?? Infinity) - (b.precoAte ?? Infinity))
  return cand[0] || { taxaPercent: 0, taxaFixa: 0 }
}

/** Resolver PURO (client/server): a taxa efetiva de um canal para um preço, a partir
 *  dos canais do workspace + catálogo. É a FONTE ÚNICA — CanalVenda(custom) → CanalVenda
 *  (gerenciado, com ajuste) sobre o catálogo → catálogo puro → nenhum. `variante`/`categoria`
 *  do produto (ex.: Clássico/Premium do ML) têm prioridade sobre o que a artesã salvou. */
export function resolverTaxaLocal(
  canaisWs: CanalVendaRow[],
  catalogo: CanalCatalogoRow[],
  canal: string,
  preco: number,
  ctx: { variante?: string | null; categoria?: string | null } = {},
): TaxaEfetiva {
  const slug = normalizarCanal(canal)
  const cv = (canaisWs || []).find(c => normalizarCanal(c.canal) === slug)
  if (cv?.origem === 'custom') {
    return { canal: slug, nome: cv.nome, taxaPercent: cv.taxaPercent || 0, taxaFixa: cv.taxaFixa || 0, pixDias: cv.pixDias || 0, cartaoDias: cv.cartaoDias || 0, origem: 'custom', atualizadoEm: null }
  }
  const cat = (catalogo || []).find(c => normalizarCanal(c.canal) === slug)
  if (cat) {
    const variante = ctx.variante ?? cv?.variante ?? null
    const categoria = ctx.categoria ?? cv?.categoria ?? null
    const regra = escolherRegra(cat.regras, { preco, categoria, variante })
    const ajustado = !!(cv && (cv.overridePercent != null || cv.overrideFixa != null))
    return {
      canal: slug, nome: cv?.nome || cat.nome,
      taxaPercent: (cv && cv.overridePercent != null) ? cv.overridePercent : regra.taxaPercent,
      taxaFixa: (cv && cv.overrideFixa != null) ? cv.overrideFixa : regra.taxaFixa,
      pixDias: cat.pixDias, cartaoDias: cat.cartaoDias, origem: cv ? 'gerenciado' : 'catalogo',
      atualizadoEm: cat.atualizadoEm, ajustado,
    }
  }
  return { canal: slug || 'outros', nome: canal || 'Outros', taxaPercent: 0, taxaFixa: 0, pixDias: 0, cartaoDias: 2, origem: 'nenhum', atualizadoEm: null }
}

/** Líquido = bruto − (bruto×% + fixa). Nunca negativo. */
export function calcularLiquido(bruto: number, taxa: Pick<TaxaEfetiva, 'taxaPercent' | 'taxaFixa'>): number {
  const b = Math.max(0, Number(bruto) || 0)
  return Math.max(0, Math.round((b - b * (Number(taxa.taxaPercent) || 0) / 100 - (Number(taxa.taxaFixa) || 0)) * 100) / 100)
}

/** Quanto o canal leva em R$ (para exibir). */
export function valorTaxa(bruto: number, taxa: Pick<TaxaEfetiva, 'taxaPercent' | 'taxaFixa'>): number {
  const b = Math.max(0, Number(bruto) || 0)
  return Math.round((b * (Number(taxa.taxaPercent) || 0) / 100 + (Number(taxa.taxaFixa) || 0)) * 100) / 100
}

/** Data de recebimento (YYYY-MM-DD) = base + prazo do método (Pix D+0, cartão D+2…). */
export function dataRecebimento(base: Date, taxa: Pick<TaxaEfetiva, 'pixDias' | 'cartaoDias'>, metodo?: string | null): string {
  const dias = String(metodo || '').toLowerCase().includes('pix') ? (taxa.pixDias || 0) : (taxa.cartaoDias || 0)
  const d = new Date(base); d.setDate(d.getDate() + Math.max(0, dias | 0))
  return d.toISOString().slice(0, 10)
}
