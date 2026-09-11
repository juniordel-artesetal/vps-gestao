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
import zlib from 'node:zlib'

// PNG sólido WxH (sem libs) — para ter uma imagem VÁLIDA no teste de upload/publicação.
function crc32(buf: Buffer): number {
  let c = ~0
  for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)) }
  return ~c >>> 0
}
function chunk(tipo: string, dados: Buffer): Buffer {
  const t = Buffer.from(tipo, 'ascii')
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length)
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, dados])))
  return Buffer.concat([len, t, dados, crc])
}
function pngSolido(w: number, h: number, rgb: [number, number, number]): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2 // 8-bit, RGB
  const linha = Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: w }, () => Buffer.from(rgb)))])
  const raw = Buffer.concat(Array.from({ length: h }, () => linha))
  const idat = zlib.deflateSync(raw)
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

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

  // Upload de imagem (multipart) — a assinatura do TikTok para multipart EXCLUI o corpo.
  async function uploadImagem(useCase = 'MAIN_IMAGE') {
    const path = '/product/202309/images/upload'
    // ⚠️ Upload de imagem NÃO leva shop_cipher (é da mídia do seller, não de uma loja).
    const params: Record<string, string> = { app_key: process.env.TIKTOK_APP_KEY || '', timestamp: String(Math.floor(Date.now() / 1000)) }
    params.sign = assinarRequisicao(path, params) // sem corpo (multipart) e sem shop_cipher
    const png = pngSolido(600, 600, [240, 130, 30])
    const fd = new FormData()
    fd.append('data', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'teste.png')
    fd.append('use_case', useCase)
    const url = `${TIKTOK_ENDPOINTS.apiBase}${path}?${new URLSearchParams(params).toString()}`
    let status = 0, resp: any = null
    try {
      const r = await fetch(url, { method: 'POST', body: fd, headers: { 'x-tts-access-token': token! }, signal: AbortSignal.timeout(25000) })
      status = r.status; resp = await r.json().catch(() => ({}))
    } catch (e) { resp = { _erro: (e as Error)?.message } }
    return { endpoint: `POST ${path} (multipart)`, requestEnviado: { params: { ...params, sign: '***' }, body: `PNG 600x600 use_case=${useCase}` }, httpStatus: status, respostaCrua: resp, ok: resp?.code === 0, uri: resp?.data?.uri ?? null }
  }

  const loja = { workspaceId: conx.workspaceId, shopId: conx.shopId, sellerName: conx.sellerName }

  if (acao === 'imagem') {
    return NextResponse.json({ loja, ...(await uploadImagem(body?.useCase ?? 'MAIN_IMAGE')) })
  }

  if (acao === 'categorias') {
    return NextResponse.json({ loja, ...(await raw('GET', '/product/202309/categories')) })
  }

  if (acao === 'atributos') {
    const cat = String(body?.categoriaId ?? '')
    if (!cat) return NextResponse.json({ error: 'informe categoriaId' }, { status: 400 })
    return NextResponse.json({ loja, ...(await raw('GET', `/product/202309/categories/${encodeURIComponent(cat)}/attributes`)) })
  }

  if (acao === 'publicar') {
    // Sem imagens no body → sobe uma placeholder e usa a URI (MainImages é obrigatório).
    let uris: string[] = body?.imagens ?? []
    let uploadInfo: any = null
    if (uris.length === 0) {
      const up = await uploadImagem('MAIN_IMAGE')
      uploadInfo = { ok: up.ok, uri: up.uri, resposta: up.respostaCrua }
      if (up.uri) uris = [up.uri]
    }
    // WarehouseId é obrigatório no inventory → busca o armazém do seller.
    let warehouseId: string | null = body?.warehouseId ?? null
    let warehouseInfo: any = null
    if (!warehouseId) {
      const wh = await raw('GET', '/logistics/202309/warehouses')
      warehouseId = wh.respostaCrua?.data?.warehouses?.[0]?.id ?? null
      warehouseInfo = { ok: wh.ok, id: warehouseId, resposta: wh.respostaCrua }
    }
    // Payload de PRODUTO DE TESTE (rascunho). Campos overridáveis pelo body para iterar.
    const payload = {
      save_mode: 'AS_DRAFT',
      title: body?.title ?? 'Produto de teste SOA (rascunho)',
      description: body?.description ?? 'Anúncio de teste criado pela integração SOA — pode apagar.',
      category_id: body?.categoriaId,
      brand_id: body?.brandId,
      main_images: uris.map((uri: string) => ({ uri })),
      package_weight: { value: String(body?.pesoGramas ?? 300), unit: 'GRAM' },
      package_dimensions: { length: String(body?.comprimento ?? 10), width: String(body?.largura ?? 10), height: String(body?.altura ?? 5), unit: 'CENTIMETER' },
      skus: [{
        seller_sku: body?.sku ?? 'SOA-TESTE-1',
        price: { amount: String(body?.preco ?? 29.9), currency: 'BRL' },
        inventory: [{ quantity: Number(body?.estoque ?? 5), ...(warehouseId ? { warehouse_id: warehouseId } : {}) }],
      }],
      ...(body?.payloadExtra ?? {}),
    }
    return NextResponse.json({ loja, uploadInfo, warehouseInfo, ...(await raw('POST', '/product/202309/products', payload)) })
  }

  if (acao === 'warehouses') {
    return NextResponse.json({ loja, ...(await raw('GET', '/logistics/202309/warehouses')) })
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
