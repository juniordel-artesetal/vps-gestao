// Fase 2 — escrita no TikTok Shop (Product/Catalog + Inventory). SERVER-ONLY.
//
// ✅ VALIDADO na loja de dev (rota de diagnóstico, 09/2026): categorias, upload de imagem,
// publicar (rascunho) e atualizar estoque retornaram code:0. Aprendizados aplicados aqui:
// upload de imagem é multipart e SEM shop_cipher; publicar exige URI de imagem + warehouse_id
// do SALES_WAREHOUSE; inventory usa o ID do SKU (não seller_sku) + o mesmo warehouse.
// Chamadas assinadas (assinarRequisicao) e idempotentes pelo vínculo (não duplica anúncio).
import { getAccessTokenValido, shopCipherDe, assinarRequisicao, credenciaisConfiguradas } from '@/lib/tiktok/conta'
import { TIKTOK_ENDPOINTS } from '@/lib/tiktok/config'
import { lerVinculo, salvarVinculo, salvarCampos, type CamposMarketplace } from '@/lib/marketplace/produtoCampos'
import { checarCategoria, montarAtributos, checarRegras, descricaoHtml, montarSkus, avisosAnuncio, type CategoriaTT, type AtributoTT, type RegrasCategoriaTT, type VarTT } from '@/lib/tiktok/regrasProduto'

const CANAL = 'tiktokshop'

interface CtxTikTok { token: string; cipher: string }
async function contexto(workspaceId: string): Promise<CtxTikTok | { erro: string }> {
  if (!credenciaisConfiguradas()) return { erro: 'Credenciais do TikTok não configuradas.' }
  const token = await getAccessTokenValido(workspaceId)
  if (!token) return { erro: 'Loja do TikTok não conectada.' }
  const cipher = await shopCipherDe(workspaceId)
  if (!cipher) return { erro: 'Loja sem shop_cipher — reconecte.' }
  return { token, cipher }
}

// Chamada assinada genérica ao open-api (com shop_cipher). GET sem corpo; POST/PUT com JSON.
async function chamar(ctx: CtxTikTok, metodo: 'GET' | 'POST' | 'PUT', path: string, corpo?: unknown, extra?: Record<string, string>): Promise<{ ok: boolean; code?: number; msg?: string; data?: any }> {
  // Query params (category_id, brand_name…) entram ASSINADOS — nunca concatenar no path.
  const params: Record<string, string> = {
    ...(extra ?? {}),
    app_key: process.env.TIKTOK_APP_KEY || '',
    timestamp: String(Math.floor(Date.now() / 1000)),
    shop_cipher: ctx.cipher,
  }
  const body = corpo === undefined ? undefined : JSON.stringify(corpo)
  params.sign = assinarRequisicao(path, params, body)
  const url = `${TIKTOK_ENDPOINTS.apiBase}${path}?${new URLSearchParams(params).toString()}`
  try {
    const r = await fetch(url, {
      method: metodo, body,
      headers: { 'content-type': 'application/json', 'x-tts-access-token': ctx.token },
      signal: AbortSignal.timeout(20000),
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok || j?.code !== 0) return { ok: false, code: j?.code, msg: j?.message || `HTTP ${r.status}` }
    return { ok: true, data: j?.data }
  } catch (e) {
    return { ok: false, msg: (e as Error)?.name === 'TimeoutError' ? 'TikTok não respondeu a tempo.' : 'Falha de conexão com o TikTok.' }
  }
}

/** Árvore de categorias do canal (para o seletor). */
export async function buscarCategorias(workspaceId: string): Promise<{ ok: boolean; erro?: string; categorias?: any[] }> {
  const ctx = await contexto(workspaceId)
  if ('erro' in ctx) return { ok: false, erro: ctx.erro }
  const r = await chamar(ctx, 'GET', '/product/202309/categories')
  if (!r.ok) return { ok: false, erro: r.msg }
  return { ok: true, categorias: r.data?.categories ?? [] }
}

/** Atributos (obrigatórios/opcionais) de uma categoria — para o bloco de campos. */
export async function buscarAtributosCategoria(workspaceId: string, categoriaId: string): Promise<{ ok: boolean; erro?: string; atributos?: any[] }> {
  const ctx = await contexto(workspaceId)
  if ('erro' in ctx) return { ok: false, erro: ctx.erro }
  const r = await chamar(ctx, 'GET', `/product/202309/categories/${encodeURIComponent(categoriaId)}/attributes`)
  if (!r.ok) return { ok: false, erro: r.msg }
  return { ok: true, atributos: r.data?.attributes ?? [] }
}

/** Regras da categoria (tabela de medidas, certificações, dimensões obrigatórias). */
export async function buscarRegrasCategoria(workspaceId: string, categoriaId: string): Promise<{ ok: boolean; erro?: string; regras?: RegrasCategoriaTT }> {
  const ctx = await contexto(workspaceId)
  if ('erro' in ctx) return { ok: false, erro: ctx.erro }
  const r = await chamar(ctx, 'GET', `/product/202309/categories/${encodeURIComponent(categoriaId)}/rules`)
  if (!r.ok) return { ok: false, erro: r.msg }
  return { ok: true, regras: r.data ?? {} }
}

// Cache curto da árvore de categorias por workspace (a lista é grande e muda pouco).
const cacheCats = new Map<string, { em: number; cats: CategoriaTT[] }>()
async function categoriasCache(ctx: CtxTikTok, workspaceId: string): Promise<CategoriaTT[] | null> {
  const c = cacheCats.get(workspaceId)
  if (c && Date.now() - c.em < 30 * 60_000) return c.cats
  const r = await chamar(ctx, 'GET', '/product/202309/categories')
  if (!r.ok) return null
  const cats = (r.data?.categories ?? []) as CategoriaTT[]
  cacheCats.set(workspaceId, { em: Date.now(), cats })
  return cats
}

/** Marca: ID numérico passa direto; nome → busca na lista de marcas da categoria. Sem marca/achado → sem brand_id (= "Sem marca"). */
async function marcaId(ctx: CtxTikTok, categoriaId: string, marca: string | undefined): Promise<string | undefined> {
  const m = (marca || '').trim()
  if (!m || /^(sem marca|no brand|nenhuma|-)$/i.test(m)) return undefined
  if (/^\d{6,}$/.test(m)) return m
  const r = await chamar(ctx, 'GET', '/product/202309/brands', undefined, { category_id: categoriaId, brand_name: m, page_size: '20' })
  const lista: { id?: string; name?: string }[] = r.ok ? (r.data?.brands ?? []) : []
  const achada = lista.find(b => String(b.name).trim().toLowerCase() === m.toLowerCase())
  return achada?.id ? String(achada.id) : undefined
}

// ── Aprendizados VALIDADOS na loja de dev (via rota de diagnóstico) ──────────
// 1) Upload de imagem: POST /product/202309/images/upload é MULTIPART e NÃO leva shop_cipher.
// 2) Publicar: main_images usa a URI retornada pelo upload; inventory exige warehouse_id do
//    SALES_WAREHOUSE (não o de devolução) + peso/dimensões.
// 3) Inventory update: usa o ID do SKU no TikTok (não o seller_sku) + o mesmo warehouse.

/** Upload de UMA imagem (baixa a URL do SOA e sobe pro TikTok). Devolve a URI do TikTok. */
async function uploadImagem(ctx: CtxTikTok, urlOuUri: string): Promise<string | null> {
  if (!urlOuUri) return null
  // Sobe fotos por URL http(s) OU data:base64 (as fotos do produto no SOA são data: URI).
  // Um valor que não é URL é tratado como URI do TikTok já existente (pass-through).
  const ehUpload = /^https?:\/\//i.test(urlOuUri) || urlOuUri.startsWith('data:')
  if (!ehUpload) return urlOuUri
  let bytes: ArrayBuffer
  try {
    const img = await fetch(urlOuUri, { signal: AbortSignal.timeout(15000) }) // fetch suporta data: no Node
    if (!img.ok) return null
    bytes = await img.arrayBuffer()
  } catch { return null }
  // Assinatura do multipart: SEM shop_cipher e SEM corpo.
  const path = '/product/202309/images/upload'
  const params: Record<string, string> = { app_key: process.env.TIKTOK_APP_KEY || '', timestamp: String(Math.floor(Date.now() / 1000)) }
  params.sign = assinarRequisicao(path, params)
  const fd = new FormData()
  fd.append('data', new Blob([bytes]), 'img')
  fd.append('use_case', 'MAIN_IMAGE')
  try {
    const r = await fetch(`${TIKTOK_ENDPOINTS.apiBase}${path}?${new URLSearchParams(params).toString()}`, {
      method: 'POST', body: fd, headers: { 'x-tts-access-token': ctx.token }, signal: AbortSignal.timeout(25000),
    })
    const j: any = await r.json().catch(() => ({}))
    return j?.data?.uri ?? null
  } catch { return null }
}

/** Warehouse de VENDAS do seller (para o inventory). null se não achar. */
async function warehouseVendas(ctx: CtxTikTok): Promise<string | null> {
  const r = await chamar(ctx, 'GET', '/logistics/202309/warehouses')
  const lista: any[] = r.data?.warehouses ?? []
  const sales = lista.find(w => w.type === 'SALES_WAREHOUSE' && w.is_default) ?? lista.find(w => w.type === 'SALES_WAREHOUSE') ?? lista[0]
  return sales?.id ?? null
}

/**
 * Publica (cria) ou ATUALIZA o anúncio no TikTok a partir do produto do SOA. Idempotente:
 * se já existe vínculo (produtoExternoId), faz UPDATE do mesmo anúncio — nunca cria outro.
 * Sobe as imagens (URL do SOA → URI do TikTok) e usa o SALES_WAREHOUSE no estoque.
 */
export async function publicarProduto(
  workspaceId: string, produtoId: string, nome: string,
  campos: CamposMarketplace, variacoes: VarTT[], skuBase: string, opts: { rascunho?: boolean } = {},
): Promise<{ ok: boolean; erro?: string; produtoExternoId?: string; status?: string; avisos?: string[] }> {
  const ctx = await contexto(workspaceId)
  if ('erro' in ctx) return { ok: false, erro: ctx.erro }
  const vinc = await lerVinculo(workspaceId, produtoId, CANAL)
  const statusAlvo = opts.rascunho ? 'rascunho' : 'publicado'
  const falhar = async (erro: string) => {
    await salvarVinculo(workspaceId, produtoId, CANAL, { status: vinc?.produtoExternoId ? vinc.status : 'pendente', ultimoErro: erro.slice(0, 1000) })
    return { ok: false, erro }
  }

  // ── Pré-checagem pela PRÓPRIA API do TikTok (antes de subir imagem) ─────────────────
  // 1) categoria existe e é FOLHA; 2) atributos obrigatórios da categoria; 3) regras (tabela de
  // medidas, certificação, dimensões). Tudo que falta vai junto numa mensagem só.
  const cats = await categoriasCache(ctx, workspaceId)
  if (!cats) return falhar('Não consegui ler as categorias do TikTok agora — tente de novo em instantes.')
  const cat = checarCategoria(cats, campos.categoriaId)
  if (!cat.ok) return falhar(cat.erro)
  const categoriaId = String(campos.categoriaId).trim()
  const [rAttr, rRegras] = await Promise.all([
    chamar(ctx, 'GET', `/product/202309/categories/${encodeURIComponent(categoriaId)}/attributes`),
    chamar(ctx, 'GET', `/product/202309/categories/${encodeURIComponent(categoriaId)}/rules`),
  ])
  if (!rAttr.ok) return falhar(`Não consegui ler os atributos da categoria no TikTok (${rAttr.msg}).`)
  const attrs = montarAtributos((rAttr.data?.attributes ?? []) as AtributoTT[], campos.atributos)
  const d = campos.dimensoes || {}
  const temDim = !!(d.comprimento && d.largura && d.altura)
  const problemas = [
    ...(attrs.faltando.length ? [`Preencha os atributos obrigatórios da categoria: ${attrs.faltando.join(', ')}.`] : []),
    ...attrs.invalidos,
    ...checarRegras(rRegras.ok ? rRegras.data : null, temDim),
  ]
  if (problemas.length) return falhar(problemas.join(' '))

  // Sobe cada imagem e coleta as URIs (obrigatório: pelo menos 1).
  const uris = (await Promise.all((campos.imagens || []).map(u => uploadImagem(ctx, u)))).filter(Boolean) as string[]
  if (uris.length === 0) {
    await salvarVinculo(workspaceId, produtoId, CANAL, { status: vinc?.status ?? 'nao_publicado', ultimoErro: 'nenhuma imagem pôde ser enviada ao TikTok' })
    return { ok: false, erro: 'Não consegui enviar as imagens ao TikTok (confira as URLs das imagens).' }
  }
  const warehouseId = await warehouseVendas(ctx)
  if (!warehouseId) return falhar('A loja do TikTok não tem armazém de vendas cadastrado (Seller Center → Logística → Armazéns).')
  const brandId = await marcaId(ctx, categoriaId, campos.marca)
  const gtin = /^\d{8,14}$/.test(String(campos.gtin || '').trim()) ? String(campos.gtin).trim() : undefined
  const skus = montarSkus(variacoes, skuBase, warehouseId, gtin)
  const payload = {
    save_mode: opts.rascunho ? 'AS_DRAFT' : 'LISTING',
    title: (campos.titulo || nome || '').slice(0, 255),
    description: descricaoHtml(campos.descricao, campos.titulo || nome || ''),
    category_id: categoriaId,
    ...(brandId ? { brand_id: brandId } : {}),
    main_images: uris.map(uri => ({ uri })),
    package_weight: { value: String(campos.pesoGramas), unit: 'GRAM' },
    package_dimensions: temDim
      ? { length: String(d.comprimento), width: String(d.largura), height: String(d.altura), unit: 'CENTIMETER' } : undefined,
    ...(attrs.product_attributes.length ? { product_attributes: attrs.product_attributes } : {}),
    skus: skus.map(s => s.sku),
  }

  const r = vinc?.produtoExternoId
    ? await chamar(ctx, 'PUT', `/product/202309/products/${encodeURIComponent(vinc.produtoExternoId)}`, payload)
    : await chamar(ctx, 'POST', '/product/202309/products', payload)
  if (!r.ok) return falhar(`TikTok recusou: ${r.msg ?? 'erro ao publicar'}${r.code ? ` (código ${r.code})` : ''}`)
  const externoId = r.data?.product_id ?? vinc?.produtoExternoId ?? null
  await salvarVinculo(workspaceId, produtoId, CANAL, { produtoExternoId: externoId, status: statusAlvo, ultimoErro: null })
  // seller_sku → variação do SOA: o pedido que chega do TikTok acha a variação certa (estoque).
  await salvarCampos(workspaceId, produtoId, { skusTikTok: Object.fromEntries(skus.map(s => [s.sku.seller_sku, s.variacaoId])) })
  const avisos = avisosAnuncio(uris.length, variacoes.reduce((t, v) => t + (Number(v.estoque) || 0), 0))
  return { ok: true, produtoExternoId: externoId ?? undefined, status: statusAlvo, avisos }
}

/**
 * Empurra o ESTOQUE do SOA (fonte da verdade) para o anúncio no TikTok (Inventory API).
 * Mapeia seller_sku → ID do SKU no TikTok (a API exige o id) e usa o SALES_WAREHOUSE.
 * Idempotente. Requer o produto já publicado (vínculo com produtoExternoId).
 */
export async function sincronizarEstoque(
  workspaceId: string, produtoId: string, skus: { sku: string; quantidade: number }[],
): Promise<{ ok: boolean; erro?: string }> {
  const ctx = await contexto(workspaceId)
  if ('erro' in ctx) return { ok: false, erro: ctx.erro }
  const vinc = await lerVinculo(workspaceId, produtoId, CANAL)
  if (!vinc?.produtoExternoId) return { ok: false, erro: 'Produto ainda não publicado no TikTok.' }

  // Busca o produto no TikTok para mapear seller_sku → id do SKU + o warehouse de cada SKU.
  const prod = await chamar(ctx, 'GET', `/product/202309/products/${encodeURIComponent(vinc.produtoExternoId)}`)
  if (!prod.ok) return { ok: false, erro: prod.msg }
  const skusTikTok: any[] = prod.data?.skus ?? []
  const warehouseId = await warehouseVendas(ctx)

  const itens = skus.map(s => {
    const alvo = skusTikTok.find(t => t.seller_sku === s.sku) ?? (skusTikTok.length === 1 ? skusTikTok[0] : null)
    if (!alvo?.id) return null
    // Usa o warehouse ORIGINAL do SKU quando disponível (o TikTok não deixa trocar de warehouse).
    const wh = alvo.inventory?.[0]?.warehouse_id ?? warehouseId
    return { id: alvo.id, inventory: [{ quantity: Math.max(0, Math.round(s.quantidade)), ...(wh ? { warehouse_id: wh } : {}) }] }
  }).filter(Boolean)
  if (itens.length === 0) return { ok: false, erro: 'Nenhum SKU do TikTok casou com os SKUs informados.' }

  const r = await chamar(ctx, 'POST', `/product/202309/products/${encodeURIComponent(vinc.produtoExternoId)}/inventory/update`, { skus: itens })
  if (!r.ok) {
    await salvarVinculo(workspaceId, produtoId, CANAL, { status: vinc.status, ultimoErro: r.msg ?? 'erro ao sincronizar estoque' })
    return { ok: false, erro: r.msg }
  }
  return { ok: true }
}
