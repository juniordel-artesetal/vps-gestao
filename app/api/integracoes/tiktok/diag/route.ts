// ⚠️ ROTA DE DIAGNÓSTICO TEMPORÁRIA — REMOVER após validar os payloads na loja de dev.
// Roda no servidor (onde o token existe), executa as chamadas de ESCRITA do TikTok contra a
// loja de dev conectada e devolve o request+response CRU para ajustar os payloads.
//
// SEGURANÇA: gated por DIAG_SECRET (header x-diag ou ?diag=). Sem o env ou sem match → 404.
// Só age na loja de dev CONECTADA (TikTokConexao.conectado). Produtos vão como RASCUNHO.
// NUNCA retorna token/refresh/app_secret/sign (mascarados).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAccessTokenValido, shopCipherDe, assinarRequisicao } from '@/lib/tiktok/conta'
import { TIKTOK_ENDPOINTS } from '@/lib/tiktok/config'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function na() { return NextResponse.json({ error: 'Not found' }, { status: 404 }) }

export async function POST(req: NextRequest) {
  const segredo = process.env.DIAG_SECRET
  const enviado = req.headers.get('x-diag') || new URL(req.url).searchParams.get('diag')
  if (!segredo || enviado !== segredo) return na()

  const body = await req.json().catch(() => ({} as any))
  const acao = String(body?.acao ?? '')

  // Loja de dev conectada (só há a de teste). Nunca toca loja real por engano.
  const [conx] = await prisma.$queryRaw`
    SELECT "workspaceId", "shopId", "sellerName" FROM "TikTokConexao" WHERE "conectado" = true ORDER BY "updatedAt" DESC LIMIT 1
  ` as { workspaceId: string; shopId: string | null; sellerName: string | null }[]
  if (!conx) return NextResponse.json({ error: 'Nenhuma loja TikTok conectada.' }, { status: 400 })

  const token = await getAccessTokenValido(conx.workspaceId)
  const cipher = await shopCipherDe(conx.workspaceId)
  if (!token || !cipher) return NextResponse.json({ error: 'Sem token/cipher — reconecte a loja.' }, { status: 400 })

  // Chamada assinada que devolve o CRU (mascara sign; nunca inclui o token no retorno).
  async function raw(metodo: 'GET' | 'POST' | 'PUT', path: string, corpo?: unknown) {
    const params: Record<string, string> = {
      app_key: process.env.TIKTOK_APP_KEY || '',
      timestamp: String(Math.floor(Date.now() / 1000)),
      shop_cipher: cipher!,
    }
    const bodyStr = corpo === undefined ? undefined : JSON.stringify(corpo)
    params.sign = assinarRequisicao(path, params, bodyStr)
    const url = `${TIKTOK_ENDPOINTS.apiBase}${path}?${new URLSearchParams(params).toString()}`
    let status = 0, resp: any = null
    try {
      const r = await fetch(url, { method: metodo, body: bodyStr, headers: { 'content-type': 'application/json', 'x-tts-access-token': token! }, signal: AbortSignal.timeout(25000) })
      status = r.status
      resp = await r.json().catch(async () => ({ _texto: (await r.text().catch(() => '')).slice(0, 2000) }))
    } catch (e) { resp = { _erro: (e as Error)?.message } }
    const paramsMasc = { ...params, sign: '***' }
    return {
      endpoint: `${metodo} ${path}`,
      requestEnviado: { params: paramsMasc, body: corpo ?? null },
      httpStatus: status,
      respostaCrua: resp,
      ok: resp?.code === 0,
    }
  }

  const loja = { workspaceId: conx.workspaceId, shopId: conx.shopId, sellerName: conx.sellerName }

  if (acao === 'categorias') {
    return NextResponse.json({ loja, ...(await raw('GET', '/product/202309/categories')) })
  }

  if (acao === 'atributos') {
    const cat = String(body?.categoriaId ?? '')
    if (!cat) return NextResponse.json({ error: 'informe categoriaId' }, { status: 400 })
    return NextResponse.json({ loja, ...(await raw('GET', `/product/202309/categories/${encodeURIComponent(cat)}/attributes`)) })
  }

  if (acao === 'publicar') {
    // Payload de PRODUTO DE TESTE (rascunho). Campos overridáveis pelo body para iterar.
    const payload = {
      save_mode: 'AS_DRAFT',
      title: body?.title ?? 'Produto de teste SOA (rascunho)',
      description: body?.description ?? 'Anúncio de teste criado pela integração SOA — pode apagar.',
      category_id: body?.categoriaId,
      brand_id: body?.brandId,
      main_images: (body?.imagens ?? []).map((uri: string) => ({ uri })),
      package_weight: { value: String(body?.pesoGramas ?? 300), unit: 'GRAM' },
      package_dimensions: { length: String(body?.comprimento ?? 10), width: String(body?.largura ?? 10), height: String(body?.altura ?? 5), unit: 'CENTIMETER' },
      skus: [{
        seller_sku: body?.sku ?? 'SOA-TESTE-1',
        price: { amount: String(body?.preco ?? 29.9), currency: 'BRL' },
        inventory: [{ quantity: Number(body?.estoque ?? 5) }],
      }],
      ...(body?.payloadExtra ?? {}),
    }
    return NextResponse.json({ loja, ...(await raw('POST', '/product/202309/products', payload)) })
  }

  if (acao === 'estoque') {
    const pid = String(body?.produtoExternoId ?? '')
    if (!pid) return NextResponse.json({ error: 'informe produtoExternoId' }, { status: 400 })
    const payload = { skus: [{ seller_sku: body?.sku ?? 'SOA-TESTE-1', inventory: [{ quantity: Number(body?.quantidade ?? 3) }] }], ...(body?.payloadExtra ?? {}) }
    return NextResponse.json({ loja, ...(await raw('POST', `/product/202309/products/${encodeURIComponent(pid)}/inventory/update`, payload)) })
  }

  if (acao === 'pacotes') {
    const oid = String(body?.orderId ?? '')
    if (!oid) return NextResponse.json({ error: 'informe orderId (id externo do pedido TikTok)' }, { status: 400 })
    return NextResponse.json({ loja, ...(await raw('GET', `/fulfillment/202309/orders/${encodeURIComponent(oid)}/packages`)) })
  }

  if (acao === 'ship') {
    const pkg = String(body?.pacoteId ?? '')
    if (!pkg) return NextResponse.json({ error: 'informe pacoteId (veja em acao=pacotes)' }, { status: 400 })
    const payload = body?.payloadExtra ?? (body?.rastreio ? { tracking_number: body.rastreio } : {})
    return NextResponse.json({ loja, ...(await raw('POST', `/fulfillment/202309/packages/${encodeURIComponent(pkg)}/ship`, payload)) })
  }

  return NextResponse.json({ error: 'ação inválida', acoes: ['categorias', 'atributos', 'publicar', 'estoque', 'pacotes', 'ship'] }, { status: 400 })
}
