// Fase 2 — escrita no TikTok Shop (Product/Catalog + Inventory). SERVER-ONLY.
//
// ⚠️ NÃO EXERCITADO CONTRA A API REAL (o token vive cifrado só na Vercel; não dá para
// rodar o fluxo daqui). O formato do payload segue a doc da Product API 202309, mas DEVE
// ser conferido/ajustado no 1º teste na LOJA DE DEV antes de qualquer uso real. Todas as
// chamadas são assinadas (assinarRequisicao) e idempotentes pelo vínculo (não duplica anúncio).
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

// Monta o payload de produto da Catalog API a partir dos dados do SOA. ⚠️ Conferir no sandbox.
function montarPayload(nome: string, campos: CamposMarketplace, variacoes: VariacaoPublicar[], rascunho: boolean) {
  const d = campos.dimensoes || {}
  return {
    save_mode: rascunho ? 'AS_DRAFT' : 'LISTING', // LISTING = publica; AS_DRAFT = rascunho p/ revisar no TikTok
    title: (campos.titulo || nome || '').slice(0, 255),
    description: campos.descricao || nome || '',
    category_id: campos.categoriaId,
    brand_id: campos.marca || undefined,
    main_images: (campos.imagens || []).map(uri => ({ uri })),
    package_weight: campos.pesoGramas ? { value: String(campos.pesoGramas), unit: 'GRAM' } : undefined,
    package_dimensions: (d.comprimento && d.largura && d.altura)
      ? { length: String(d.comprimento), width: String(d.largura), height: String(d.altura), unit: 'CENTIMETER' } : undefined,
    product_attributes: campos.atributos
      ? Object.entries(campos.atributos).map(([id, valor]) => ({ id, values: [{ name: String(valor) }] })) : undefined,
    skus: variacoes.map(v => ({
      seller_sku: v.sku || undefined,
      sales_attributes: v.nome ? [{ name: 'Variação', value_name: v.nome }] : undefined,
      price: { amount: String(Math.round(Number(v.preco) * 100) / 100), currency: 'BRL' },
      inventory: v.estoque != null ? [{ quantity: Math.max(0, Math.round(v.estoque)) }] : undefined,
      ...(campos.gtin ? { identifier_code: { code: campos.gtin, type: 'GTIN' } } : {}),
    })),
  }
}

/**
 * Publica (cria) ou ATUALIZA o anúncio no TikTok a partir do produto do SOA. Idempotente:
 * se já existe vínculo (produtoExternoId), faz UPDATE do mesmo anúncio — nunca cria outro.
 */
export async function publicarProduto(
  workspaceId: string, produtoId: string, nome: string,
  campos: CamposMarketplace, variacoes: VariacaoPublicar[], opts: { rascunho?: boolean } = {},
): Promise<{ ok: boolean; erro?: string; produtoExternoId?: string; status?: string }> {
  const ctx = await contexto(workspaceId)
  if ('erro' in ctx) return { ok: false, erro: ctx.erro }

  const vinc = await lerVinculo(workspaceId, produtoId, CANAL)
  const payload = montarPayload(nome, campos, variacoes, !!opts.rascunho)
  const statusAlvo = opts.rascunho ? 'rascunho' : 'publicado'

  // UPDATE do mesmo anúncio quando já existe; senão CREATE. (idempotente, sem duplicar)
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
 * Idempotente. Requer o produto já publicado (vínculo com produtoExternoId).
 */
export async function sincronizarEstoque(
  workspaceId: string, produtoId: string, skus: { sku: string; quantidade: number }[],
): Promise<{ ok: boolean; erro?: string }> {
  const ctx = await contexto(workspaceId)
  if ('erro' in ctx) return { ok: false, erro: ctx.erro }
  const vinc = await lerVinculo(workspaceId, produtoId, CANAL)
  if (!vinc?.produtoExternoId) return { ok: false, erro: 'Produto ainda não publicado no TikTok.' }

  const body = {
    skus: skus.map(s => ({ seller_sku: s.sku, inventory: [{ quantity: Math.max(0, Math.round(s.quantidade)) }] })),
  }
  const r = await chamar(ctx, 'POST', `/product/202309/products/${encodeURIComponent(vinc.produtoExternoId)}/inventory/update`, body)
  if (!r.ok) {
    await salvarVinculo(workspaceId, produtoId, CANAL, { status: vinc.status, ultimoErro: r.msg ?? 'erro ao sincronizar estoque' })
    return { ok: false, erro: r.msg }
  }
  return { ok: true }
}
