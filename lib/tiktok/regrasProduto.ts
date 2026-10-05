// Regras PURAS do anúncio no TikTok Shop (sem rede/banco — testáveis). A publicação chama a API
// (categorias, atributos, regras da categoria, marcas) e passa as respostas por aqui ANTES de
// montar o payload do Create Product (202309). Os erros mais comuns do TikTok são categoria que
// não é FOLHA e atributo obrigatório da categoria faltando — os dois são barrados aqui, com
// mensagem em português, em vez de virar um "invalid param" genérico.

export interface CategoriaTT { id: string; parent_id?: string; local_name?: string; is_leaf?: boolean }
export interface ValorAtributoTT { id: string; name: string }
export interface AtributoTT {
  id: string; name: string; type?: string
  is_requried?: boolean; is_required?: boolean       // a 202309 escreve "is_requried" (sic)
  is_customizable?: boolean; is_multiple_selection?: boolean
  values?: ValorAtributoTT[]
}
export interface RegrasCategoriaTT {
  product_certifications?: { id: string; name: string; is_required?: boolean }[]
  size_chart?: { is_supported?: boolean; is_required?: boolean }
  package_dimension?: { is_required?: boolean }
}

const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

export const ehObrigatorio = (a: AtributoTT) => !!(a.is_requried ?? a.is_required)
/** Atributos de PRODUTO (os de venda viram sales_attributes dos SKUs). */
export const atributosDeProduto = (lista: AtributoTT[]) => (lista || []).filter(a => (a.type ?? 'PRODUCT_PROPERTY') === 'PRODUCT_PROPERTY')

/** Caminho legível da categoria ("Casa > Decoração > Quadros"). */
export function caminhoCategoria(cats: CategoriaTT[], id: string): string {
  const porId = new Map(cats.map(c => [String(c.id), c]))
  const nomes: string[] = []
  let c = porId.get(String(id)), guarda = 0
  while (c && guarda++ < 10) { nomes.unshift(c.local_name || String(c.id)); c = c.parent_id && c.parent_id !== '0' ? porId.get(String(c.parent_id)) : undefined }
  return nomes.join(' > ')
}

/** A categoria existe, é numérica e é FOLHA? (o TikTok só aceita produto em categoria folha). */
export function checarCategoria(cats: CategoriaTT[], id: string | undefined): { ok: true; nome: string } | { ok: false; erro: string } {
  const v = String(id ?? '').trim()
  if (!v) return { ok: false, erro: 'Escolha a categoria do TikTok.' }
  if (!/^\d+$/.test(v)) return { ok: false, erro: `A categoria "${v}" não é um ID do TikTok — escolha a categoria na lista.` }
  const c = cats.find(x => String(x.id) === v)
  if (!c) return { ok: false, erro: `A categoria ${v} não existe (ou não está liberada) na sua loja do TikTok — escolha outra na lista.` }
  if (c.is_leaf === false) return { ok: false, erro: `"${caminhoCategoria(cats, v)}" é uma categoria-mãe. Escolha a subcategoria final (folha).` }
  return { ok: true, nome: caminhoCategoria(cats, v) }
}

/**
 * Monta product_attributes a partir dos valores da usuária (id do atributo → texto). Casa o texto
 * com a lista de valores do TikTok (manda o value.id, que é o que a API valida); atributo sem lista
 * ou "customizável" vai pelo nome. Atributos que não são da categoria atual (troca de categoria)
 * são ignorados. Devolve o que falta (obrigatório vazio) e o que é inválido (fora da lista).
 */
export function montarAtributos(lista: AtributoTT[], valores: Record<string, string> | undefined): {
  product_attributes: { id: string; values: ({ id: string } | { name: string })[] }[]
  faltando: string[]; invalidos: string[]
} {
  const out: { id: string; values: ({ id: string } | { name: string })[] }[] = []
  const faltando: string[] = [], invalidos: string[] = []
  for (const a of atributosDeProduto(lista)) {
    const bruto = String(valores?.[a.id] ?? '').trim()
    if (!bruto) { if (ehObrigatorio(a)) faltando.push(a.name); continue }
    const partes = a.is_multiple_selection ? bruto.split(/\s*[;,]\s*/).filter(Boolean) : [bruto]
    const vals: ({ id: string } | { name: string })[] = []
    for (const p of partes) {
      const achado = (a.values || []).find(v => norm(v.name) === norm(p) || String(v.id) === p)
      if (achado) vals.push({ id: String(achado.id) })
      else if (!a.values?.length || a.is_customizable) vals.push({ name: p })
      else invalidos.push(`${a.name}: "${p}" não é uma opção do TikTok (ex.: ${a.values.slice(0, 4).map(v => v.name).join(', ')})`)
    }
    if (vals.length) out.push({ id: String(a.id), values: vals })
    else if (ehObrigatorio(a) && !invalidos.some(i => i.startsWith(a.name + ':'))) faltando.push(a.name)
  }
  return { product_attributes: out, faltando, invalidos }
}

/** Exigências da categoria que o SOA ainda não preenche (tabela de medidas, certificações). */
export function checarRegras(regras: RegrasCategoriaTT | null | undefined, temDimensoes: boolean): string[] {
  const erros: string[] = []
  if (!regras) return erros
  if (regras.size_chart?.is_required) erros.push('Esta categoria exige tabela de medidas (roupas/calçados) — ainda não suportada pelo SOA; escolha outra categoria ou complete no TikTok.')
  const certs = (regras.product_certifications || []).filter(c => c.is_required)
  if (certs.length) erros.push(`Esta categoria exige certificação (${certs.map(c => c.name).join(', ')}) — envie pelo Seller Center ou escolha outra categoria.`)
  if (regras.package_dimension?.is_required && !temDimensoes) erros.push('Esta categoria exige as dimensões da embalagem.')
  return erros
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** Descrição em HTML (o TikTok exige HTML, máx. 10.000 caracteres). Texto puro vira <p> por linha. */
export function descricaoHtml(texto: string | undefined, reserva: string): string {
  const t = (texto || '').trim() || reserva
  if (/<\/?(p|br|ul|ol|li|strong|b|i|em|img|h\d)\b/i.test(t)) return t.slice(0, 10000)
  const html = t.split(/\r?\n+/).map(l => l.trim()).filter(Boolean).map(l => `<p>${esc(l)}</p>`).join('')
  if (html.length <= 10000) return html
  return html.slice(0, 9990).replace(/<[^>]*$/, '') + '</p>'
}

export interface VarTT { variacaoId: string; nome: string | null; preco: number; estoque: number }
/**
 * SKUs do anúncio: seller_sku ÚNICO por variação (base-1, base-2…; 1 variação = base) e
 * sales_attributes só quando há mais de um SKU (nome "Variação", valores sem repetir).
 */
export function montarSkus(vars: VarTT[], base: string, warehouseId: string | null, gtin?: string) {
  const multi = vars.length > 1
  const usados = new Set<string>()
  return vars.map((v, i) => {
    let valor = (v.nome || `Opção ${i + 1}`).slice(0, 50)
    while (usados.has(norm(valor))) valor = `${valor.slice(0, 45)} ${i + 1}`
    usados.add(norm(valor))
    const seller_sku = (multi ? `${base}-${i + 1}` : base).slice(0, 50)
    return {
      variacaoId: v.variacaoId,
      sku: {
        seller_sku,
        ...(multi ? { sales_attributes: [{ name: 'Variação', value_name: valor }] } : {}),
        price: { amount: (Math.round(Number(v.preco) * 100) / 100).toFixed(2), currency: 'BRL' },
        inventory: [{ quantity: Math.max(0, Math.round(Number(v.estoque) || 0)), ...(warehouseId ? { warehouse_id: warehouseId } : {}) }],
        ...(gtin ? { identifier_code: { code: gtin, type: 'GTIN' } } : {}),
      },
    }
  })
}

/** Base do seller_sku: o SKU do produto ou um código estável a partir do id. */
export const baseSku = (skuProduto: string | null | undefined, produtoId: string) =>
  (skuProduto || '').trim().replace(/\s+/g, '-').slice(0, 40) || `SOA-${produtoId.slice(0, 8).toUpperCase()}`

/** Avisos que não bloqueiam (boas práticas do TikTok). */
export function avisosAnuncio(nImagens: number, estoqueTotal: number): string[] {
  const a: string[] = []
  if (nImagens < 5) a.push(`O TikTok recomenda 5+ fotos (você tem ${nImagens}); a 1ª com fundo branco.`)
  if (estoqueTotal <= 0) a.push('O anúncio vai com estoque 0 (não aparece para compra) — informe o estoque do anúncio.')
  return a
}
