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

// ─── SHOPEE: taxa fixa da faixa até R$79,99 com VIGÊNCIA (fonte única) ───
// A Shopee reajustou a fixa dessa faixa de R$4,00 → R$4,50 a partir de 01/10/2026 (comissão de 20% e as
// outras faixas iguais). Pedido anterior à data continua com a fixa da época. Mudou de novo? Só uma linha aqui.
export const SHOPEE_FIXA_ATE_79: { desde: string; valor: number }[] = [
  { desde: '0000-01-01', valor: 4 },
  { desde: '2026-10-01', valor: 4.5 },
]
/** Dia (YYYY-MM-DD) no fuso de São Paulo — o pedido das 22h de 30/09 é de 30/09. */
function diaSP(data: Date | string): string {
  if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data)) return data
  const d = new Date(data)
  if (isNaN(d.getTime())) return typeof data === 'string' ? data.slice(0, 10) : ''
  return new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10)
}
/** Taxa fixa da Shopee na faixa até R$79,99 vigente na data (sem data = hoje). */
export function shopeeFixaAte79(data?: Date | string | null): number {
  const dia = diaSP(data ?? new Date())
  let v = SHOPEE_FIXA_ATE_79[0].valor
  for (const f of SHOPEE_FIXA_ATE_79) if (f.desde <= dia) v = f.valor
  return v
}
const brl = (v: number) => `R$${(Math.round(v * 100) / 100).toFixed(2).replace('.', ',').replace(/,00$/, '')}`
/**
 * Faixas da Shopee 2026 (CNPJ) por preço do ITEM — a tabela que as telas de precificação usam quando o
 * módulo de canais está desligado. < R$8: 50% do preço; até R$79,99: 20% + fixa vigente; acima: 14% + fixa.
 */
export function taxaShopee(preco: number, data?: Date | string | null): { taxa: number; fixo: number; faixa: 1 | 2 | 3 | 4 | 5; label: string } {
  const p = Number(preco) || 0
  if (p < 8) return { taxa: 0.5, fixo: 0, faixa: 1, label: 'Shopee Faixa 1 (<R$8) · 50%' }
  if (p < 80) { const f = shopeeFixaAte79(data); return { taxa: 0.2, fixo: f, faixa: 2, label: `Shopee Faixa 2 (R$8–79) · 20%+${brl(f)}` } }
  if (p < 100) return { taxa: 0.14, fixo: 16, faixa: 3, label: 'Shopee Faixa 3 (R$80–99) · 14%+R$16' }
  if (p < 200) return { taxa: 0.14, fixo: 20, faixa: 4, label: 'Shopee Faixa 4 (R$100–199) · 14%+R$20' }
  return { taxa: 0.14, fixo: 26, faixa: 5, label: 'Shopee Faixa 5 (≥R$200) · 14%+R$26' }
}
/** Rótulo curto "20%+R$4,50" da faixa até R$79,99 (telas). */
export const rotuloShopeeAte79 = () => `20%+${brl(shopeeFixaAte79())}`

/**
 * Fixa do CATÁLOGO na data do pedido: se o catálogo traz a fixa vigente da Shopee (≤ R$79,99), o pedido
 * de antes do reajuste paga a da época. Outro valor (ajuste do Master ou da artesã) fica como está.
 */
export function fixaNaData(slug: string, preco: number, fixa: number, data?: Date | string | null): number {
  const p = Number(preco) || 0
  if (!data || normalizarCanal(slug) !== 'shopee' || p < 8 || p > 79.995) return fixa
  return Math.abs((Number(fixa) || 0) - shopeeFixaAte79()) < 0.001 ? shopeeFixaAte79(data) : fixa
}

// ─── SEED do catálogo gerenciado (números da pesquisa jul/2026 — SUGESTÕES) ───
export const CATALOGO_SEED: ModeloCatalogo[] = [
  {
    canal: 'shopee', nome: 'Shopee', pixDias: 14, cartaoDias: 14,
    estrutura: 'Comissão por faixa de preço do item + taxa fixa (frete grátis obrigatório desde 03/2026).',
    regras: [
      { precoAte: 79.99, taxaPercent: 20, taxaFixa: shopeeFixaAte79(), label: 'Até R$79,99' },
      { precoAte: 99.99, taxaPercent: 14, taxaFixa: 16, label: 'R$80–99,99' },
      { precoAte: 199.99, taxaPercent: 14, taxaFixa: 20, label: 'R$100–199,99' },
      { precoAte: null, taxaPercent: 14, taxaFixa: 26, label: 'Acima de R$200' },
    ],
  },
  {
    canal: 'tiktokshop', nome: 'TikTok Shop', pixDias: 14, cartaoDias: 14,
    estrutura: 'Comissão por faixa de preço do item + taxa fixa por item nas duas faixas (atualizado em 04/08/2026). Novos vendedores costumam ter isenção nos ~60 primeiros dias.',
    regras: [
      { precoAte: 49.99, taxaPercent: 10, taxaFixa: 4, label: 'Abaixo de R$50' },
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

// Canais padrão do dropdown "Canal de venda" do pedido (rótulos fixos): os canais de catálogo
// gerenciados pelo SOA (Shopee, Mercado Livre, TikTok Shop, Amazon) + os manuais/diretos. São
// canais DO SISTEMA — não confundir com os canais custom que a artesã cria. Os rótulos batem
// com normalizarCanal (ex.: 'TikTok Shop' → 'tiktokshop') para o resolverTaxa achar a taxa.
export const CANAIS_PADRAO_PEDIDO = ['Shopee', 'Mercado Livre', 'TikTok Shop', 'Amazon', 'Direta', 'Instagram', 'WhatsApp', 'Outros']

// Canais de MARKETPLACE do sistema (os do catálogo gerenciado). É a lista que a tela "Números do
// Marketplace" e a config oferecem para ligar/filtrar — antes só shopee+mercadolivre estavam
// cadastrados, o que impedia até ATIVAR TikTok Shop/Amazon (o PUT respondia "Canal inválido").
export const CANAIS_MARKETPLACE = CATALOGO_SEED.map(c => c.canal)

/** Rótulo amigável de um canal de marketplace (usa o catálogo; cai no próprio slug). */
export function nomeCanalMarketplace(canal: string): string {
  const slug = normalizarCanal(canal)
  return CATALOGO_SEED.find(c => c.canal === slug)?.nome || canal
}

/** Canais CUSTOM do workspace (CanalVenda que não é um dos padrão do sistema) — para MESCLAR no
 *  dropdown do pedido (ex.: "EJC" 30% criado pela artesã). Retorna {canal: slug, nome}. O `canal`
 *  (slug) é o valor a gravar em Order.canal: normalizarCanal é idempotente nele, então resolverTaxa
 *  reencontra a taxa mesmo se o nome for editado depois. Gerenciados do catálogo (TikTok/Amazon/…)
 *  NÃO entram aqui — já são opções padrão. */
export function canaisExtraPedido(canais: { canal: string; nome: string }[] | null | undefined): { canal: string; nome: string }[] {
  const padrao = new Set(CANAIS_PADRAO_PEDIDO.map(c => normalizarCanal(c)))
  const vistos = new Set<string>()
  const out: { canal: string; nome: string }[] = []
  for (const c of canais || []) {
    const slug = normalizarCanal(c.canal)
    if (!slug || padrao.has(slug) || vistos.has(slug)) continue
    vistos.add(slug)
    out.push({ canal: slug, nome: (c.nome || c.canal || slug) })
  }
  return out
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
  ctx: { variante?: string | null; categoria?: string | null; data?: Date | string | null } = {},
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
      taxaFixa: taxaFixaDoItem(slug, preco, (cv && cv.overrideFixa != null) ? cv.overrideFixa : fixaNaData(slug, preco, regra.taxaFixa, ctx.data)),
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

// ─────────────── TAXA POR ITEM (marketplace) ───────────────
// Marketplaces cobram a comissão e a taxa fixa POR ITEM VENDIDO (unidade do anúncio), cada item na
// faixa do SEU preço. Um pedido com 3 itens de R$30 na Shopee paga 3 × (20% + R$4,50) — e não uma taxa
// fixa só, na faixa do total (R$90 → 14% + R$16), como o pedido calculava antes (líquido inflado).

/** Shopee: item abaixo de R$8 paga 50% do preço NO LUGAR da taxa fixa (regra 2026). */
export function taxaFixaDoItem(slug: string, preco: number, taxaFixa: number): number {
  const p = Number(preco) || 0, f = Number(taxaFixa) || 0
  if (normalizarCanal(slug) === 'shopee' && p > 0 && p < 8) return Math.round(Math.min(f, p * 0.5) * 100) / 100
  return f
}

/** Um produto do pedido como gravado em camposExtras.produtos (quantidade em PEÇAS p/ kit).
 *  qtdVendida = quantos ANÚNCIOS/kits foram vendidos na linha (o multiplicador da taxa); peças do
 *  kit são produção e nunca entram na taxa. componenteDe = peça de combo (preço fica na linha do combo). */
export interface ProdutoDoPedido { quantidade?: number | null; valorUnitario?: number | null; variacaoId?: string | null; qtdVendida?: number | null; componenteDe?: string | null }
/** Itens VENDIDOS no marketplace: preço de UMA unidade + quantas unidades. */
export interface UnidadeVendida { preco: number; quantidade: number }

/**
 * Unidades vendidas de um pedido, com o preço de cada uma, somando EXATAMENTE o valor do pedido.
 * - Kit conta 1 item por kit (o anúncio é o kit), não por peça: quantidade em peças ÷ peças do kit.
 * - valorUnitario pode ter sido gravado por PEÇA (importação) ou por UNIDADE (formulário): usa a
 *   leitura cuja soma bate com o valor do pedido; sem valores, divide igualmente por unidade.
 * - Sem produtos: a quantidade do pedido (1 = o pedido inteiro é um item — igual ao cálculo antigo).
 */
export function unidadesDoPedido(
  valorPedido: number, quantidadePedido: number | null | undefined,
  produtos?: ProdutoDoPedido[] | null, pecasDoKit?: (variacaoId: string) => number,
): UnidadeVendida[] {
  const bruto = Math.max(0, Number(valorPedido) || 0)
  if (bruto <= 0) return []
  // Peça de combo não é item vendido (o anúncio é o combo, que tem a sua própria linha de preço).
  const lista = (produtos || []).filter(p => (Number(p?.quantidade) || 0) > 0 && !p?.componenteDe)
  if (!lista.length) {
    const n = Math.max(1, Math.round(Number(quantidadePedido) || 1))
    return [{ preco: bruto / n, quantidade: n }]
  }
  // Itens VENDIDOS por linha: 1º a qtdVendida gravada; 2º kit da Precificação (peças ÷ peças do kit);
  // senão fica indefinido e é resolvido pelo valor logo abaixo.
  const base = lista.map(p => {
    const q = Number(p.quantidade) || 1
    const v = Number(p.valorUnitario)
    const qv = Math.round(Number(p.qtdVendida) || 0)
    const pecas = p.variacaoId && pecasDoKit ? Math.max(1, Math.round(pecasDoKit(p.variacaoId) || 1)) : 1
    const unidades: number | null = qv > 0 ? qv
      : pecas > 1 && q >= pecas ? Math.max(1, Math.round(q / pecas))
      : pecas > 1 ? Math.max(1, Math.round(q))
      : null
    return { q, unidades, v: Number.isFinite(v) && v > 0 ? v : null }
  })
  // Linha sem kit conhecido (pedido salvo sem o vínculo): "quantidade" pode ser peças de um kit com
  // valorUnitario = preço do KIT (1 vendido), ou unidades com valorUnitario = preço de cada uma.
  // Fica a leitura cuja soma bate com o valor do pedido (kit de 15 peças a R$35 ≠ 15 × R$35).
  const soma = (f: (l: typeof base[number]) => number) => base.reduce((s, l) => s + f(l), 0)
  const resolver = (comoKit: boolean) => (l: typeof base[number]) => l.unidades ?? (comoKit && l.v != null ? 1 : Math.max(1, Math.round(l.q)))
  const indefinidas = base.some(l => l.unidades == null && l.v != null && l.q > 1)
  const leituraKit = indefinidas && base.every(l => l.v != null)
    && Math.abs(soma(l => l.v! * resolver(true)(l)) - bruto) < Math.abs(soma(l => l.v! * resolver(false)(l)) - bruto)
  const linhas = base.map(l => ({ ...l, unidades: resolver(leituraKit)(l) }))
  let pesos: number[]
  if (linhas.every(l => l.v != null)) {
    const porPeca = linhas.map(l => l.v! * l.q), porUnidade = linhas.map(l => l.v! * l.unidades)
    const soma = (a: number[]) => a.reduce((s, x) => s + x, 0)
    pesos = Math.abs(soma(porPeca) - bruto) <= Math.abs(soma(porUnidade) - bruto) ? porPeca : porUnidade
  } else pesos = linhas.map(l => l.unidades)
  const total = pesos.reduce((s, x) => s + x, 0) || 1
  return linhas.map((l, i) => ({ preco: (bruto * pesos[i] / total) / l.unidades, quantidade: l.unidades }))
}

export interface TaxaDoPedido {
  bruto: number; taxaValor: number; liquido: number
  taxaPercent: number      // % efetivo do pedido (ou o % único, se todos os itens estão na mesma faixa)
  taxaFixa: number         // soma das taxas fixas (por item × quantidade)
  itens: number            // unidades vendidas consideradas
  nome: string; canal: string; base: TaxaEfetiva
}

/**
 * Taxa de um PEDIDO = soma, item a item, de (preço × % da faixa do item + taxa fixa da faixa do
 * item) × quantidade. Canal PERSONALIZADO da artesã (taxa de maquininha etc.) segue por PEDIDO:
 * % sobre o total + a fixa uma vez (o que ela cadastrou não é regra de marketplace por item).
 */
export function taxaDoPedido(unidades: UnidadeVendida[], taxaPara: (preco: number) => TaxaEfetiva): TaxaDoPedido {
  const bruto = Math.round(unidades.reduce((s, u) => s + u.preco * u.quantidade, 0) * 100) / 100
  const base = taxaPara(bruto)
  const vazio = { bruto, taxaValor: 0, liquido: bruto, taxaPercent: base.taxaPercent || 0, taxaFixa: 0, itens: 0, nome: base.nome, canal: base.canal, base }
  if (bruto <= 0) return vazio
  if (base.origem === 'custom' || base.origem === 'nenhum') {
    const tv = valorTaxa(bruto, base)
    return { ...vazio, taxaValor: tv, liquido: Math.max(0, Math.round((bruto - tv) * 100) / 100), taxaFixa: base.taxaFixa || 0, itens: unidades.reduce((s, u) => s + u.quantidade, 0) }
  }
  let taxa = 0, fixa = 0, itens = 0
  const percs = new Set<number>()
  for (const u of unidades) {
    const t = taxaPara(u.preco)
    const porItem = Math.round((u.preco * (Number(t.taxaPercent) || 0) / 100 + (Number(t.taxaFixa) || 0)) * 100) / 100
    taxa += porItem * u.quantidade; fixa += (Number(t.taxaFixa) || 0) * u.quantidade; itens += u.quantidade
    percs.add(Number(t.taxaPercent) || 0)
  }
  taxa = Math.round(taxa * 100) / 100
  const pctVariavel = Math.round(((taxa - fixa) / bruto) * 1000) / 10
  return {
    ...vazio, taxaValor: taxa, liquido: Math.max(0, Math.round((bruto - taxa) * 100) / 100),
    taxaPercent: percs.size === 1 ? [...percs][0] : pctVariavel, taxaFixa: Math.round(fixa * 100) / 100, itens,
  }
}

/** Data de recebimento (YYYY-MM-DD) = base + prazo do método (Pix D+0, cartão D+2…). */
export function dataRecebimento(base: Date, taxa: Pick<TaxaEfetiva, 'pixDias' | 'cartaoDias'>, metodo?: string | null): string {
  const dias = String(metodo || '').toLowerCase().includes('pix') ? (taxa.pixDias || 0) : (taxa.cartaoDias || 0)
  const d = new Date(base); d.setDate(d.getDate() + Math.max(0, dias | 0))
  return d.toISOString().slice(0, 10)
}
