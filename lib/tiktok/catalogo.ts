// Fase 2 — escrita no TikTok Shop (Product/Catalog + Inventory). SERVER-ONLY.
//
// ✅ VALIDADO na loja de dev (rota de diagnóstico, 09/2026): categorias, upload de imagem,
// publicar (rascunho) e atualizar estoque retornaram code:0. Aprendizados aplicados aqui:
// upload de imagem é multipart e SEM shop_cipher; publicar exige URI de imagem + warehouse_id
// do SALES_WAREHOUSE; inventory usa o ID do SKU (não seller_sku) + o mesmo warehouse.
// Chamadas assinadas (assinarRequisicao) e idempotentes pelo vínculo (não duplica anúncio).
import { getAccessTokenValido, shopCipherDe, assinarRequisicao, credenciaisConfiguradas } from '@/lib/tiktok/conta'
import { TIKTOK_ENDPOINTS } from '@/lib/tiktok/config'
import { lerVinculo, salvarVinculo, type CamposMarketplace } from '@/lib/marketplace/produtoCampos'

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
async function chamar(ctx: CtxTikTok, metodo: 'GET' | 'POST' | 'PUT', path: string, corpo?: unknown): Promise<{ ok: boolean; code?: number; msg?: string; data?: any }> {
  const params: Record<string, string> = {
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

export interface VariacaoPublicar { sku: string | null; preco: number; estoque?: number; nome?: string | null }

// ── Aprendizados VALIDADOS na loja de dev (via rota de diagnóstico) ──────────
// 1) Upload de imagem: POST /product/202309/images/upload é MULTIPART e NÃO leva shop_cipher.
// 2) Publicar: main_images usa a URI retornada pelo upload; inventory exige warehouse_id do
//    SALES_WAREHOUSE (não o de devolução) + peso/dimensões.
// 3) Inventory update: usa o ID do SKU no TikTok (não o seller_sku) + o mesmo warehouse.

/** Upload de UMA imagem (baixa a URL do SOA e sobe pro TikTok). Devolve a URI do TikTok. */
async function uploadImagem(ctx: CtxTikTok, urlOuUri: string): Promise<string | null> {
  if (!urlOuUri) return null
  if (!/^https?:\/\//i.test(urlOuUri)) return urlOuUri // já é uma URI do TikTok
  let bytes: ArrayBuffer
  try {
    const img = await fetch(urlOuUri, { signal: AbortSignal.timeout(15000) })
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
  campos: CamposMarketplace, variacoes: VariacaoPublicar[], opts: { rascunho?: boolean } = {},
): Promise<{ ok: boolean; erro?: string; produtoExternoId?: string; status?: string }> {
  const ctx = await contexto(workspaceId)
  if ('erro' in ctx) return { ok: false, erro: ctx.erro }
  const vinc = await lerVinculo(workspaceId, produtoId, CANAL)
  const statusAlvo = opts.rascunho ? 'rascunho' : 'publicado'

  // Sobe cada imagem e coleta as URIs (obrigatório: pelo menos 1).
  const uris = (await Promise.all((campos.imagens || []).map(u => uploadImagem(ctx, u)))).filter(Boolean) as string[]
  if (uris.length === 0) {
    await salvarVinculo(workspaceId, produtoId, CANAL, { status: vinc?.status ?? 'nao_publicado', ultimoErro: 'nenhuma imagem pôde ser enviada ao TikTok' })
    return { ok: false, erro: 'Não consegui enviar as imagens ao TikTok (confira as URLs das imagens).' }
  }
  const warehouseId = await warehouseVendas(ctx)
  const d = campos.dimensoes || {}
  const payload = {
    save_mode: opts.rascunho ? 'AS_DRAFT' : 'LISTING',
    title: (campos.titulo || nome || '').slice(0, 255),
    description: campos.descricao || nome || '',
    category_id: campos.categoriaId,
    brand_id: campos.marca || undefined,
    main_images: uris.map(uri => ({ uri })),
    package_weight: campos.pesoGramas ? { value: String(campos.pesoGramas), unit: 'GRAM' } : undefined,
    package_dimensions: (d.comprimento && d.largura && d.altura)
      ? { length: String(d.comprimento), width: String(d.largura), height: String(d.altura), unit: 'CENTIMETER' } : undefined,
    product_attributes: campos.atributos
      ? Object.entries(campos.atributos).map(([id, valor]) => ({ id, values: [{ name: String(valor) }] })) : undefined,
    skus: variacoes.map(v => ({
      seller_sku: v.sku || undefined,
      sales_attributes: v.nome ? [{ name: 'Variação', value_name: v.nome }] : undefined,
      price: { amount: String(Math.round(Number(v.preco) * 100) / 100), currency: 'BRL' },
      inventory: [{ quantity: Math.max(0, Math.round(Number(v.estoque) || 0)), ...(warehouseId ? { warehouse_id: warehouseId } : {}) }],
      ...(campos.gtin ? { identifier_code: { code: campos.gtin, type: 'GTIN' } } : {}),
    })),
  }

  const r = vinc?.produtoExternoId
    ? await chamar(ctx, 'PUT', `/product/202309/products/${encodeURIComponent(vinc.produtoExternoId)}`, payload)
    : await chamar(ctx, 'POST', '/product/202309/products', payload)
  if (!r.ok) {
    await salvarVinculo(workspaceId, produtoId, CANAL, { status: vinc?.status ?? 'nao_publicado', ultimoErro: r.msg ?? 'erro ao publicar' })
    return { ok: false, erro: r.msg }
  }
  const externoId = r.data?.product_id ?? vinc?.produtoExternoId ?? null
  await salvarVinculo(workspaceId, produtoId, CANAL, { produtoExternoId: externoId, status: statusAlvo, ultimoErro: null })
  return { ok: true, produtoExternoId: externoId ?? undefined, status: statusAlvo }
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
