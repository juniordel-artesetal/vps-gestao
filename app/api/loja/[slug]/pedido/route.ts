import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normNome, soDigitos } from '@/lib/normNome'

export const dynamic = 'force-dynamic'

function novoId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// Rate limit básico em memória (best-effort; anti-abuso leve). Captcha = fase futura.
const HITS = new Map<string, number[]>()
function rateLimited(chave: string, max = 8, janelaMs = 60_000): boolean {
  const agora = Date.now()
  const arr = (HITS.get(chave) || []).filter(t => agora - t < janelaMs)
  arr.push(agora)
  HITS.set(chave, arr)
  return arr.length > max
}

// POST público — cria/associa Cliente e cria o Order (canal "Loja"). Preços SEMPRE do servidor.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params

    const ip = (req.headers.get('x-forwarded-for') || 'anon').split(',')[0].trim()
    if (rateLimited(`${slug}:${ip}`))
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde um instante.' }, { status: 429 })

    const [loja] = await prisma.$queryRaw`
      SELECT "workspaceId","freteTipo","freteValor"::float AS "freteValor"
      FROM "LojaConfig" WHERE "slug" = ${slug} AND "ativo" = true LIMIT 1
    ` as any[]
    if (!loja) return NextResponse.json({ error: 'Loja indisponível' }, { status: 404 })

    const workspaceId: string = loja.workspaceId
    const body = await req.json().catch(() => ({}))

    const nome = String(body?.nome || '').trim()
    const telefone = String(body?.telefone || '').trim()
    const entrega = body?.entrega === true // true=entrega, false=retirada
    const endereco = String(body?.endereco || '').trim()
    const observacoes = String(body?.observacoes || '').trim().slice(0, 1000)
    const itensReq: any[] = Array.isArray(body?.itens) ? body.itens : []

    // Validação server-side
    if (!nome || nome.length < 2) return NextResponse.json({ error: 'Informe seu nome.' }, { status: 400 })
    if (!soDigitos(telefone) || soDigitos(telefone).length < 8)
      return NextResponse.json({ error: 'Informe um WhatsApp/telefone válido.' }, { status: 400 })
    if (itensReq.length === 0) return NextResponse.json({ error: 'Carrinho vazio.' }, { status: 400 })
    if (entrega && !endereco) return NextResponse.json({ error: 'Informe o endereço de entrega.' }, { status: 400 })

    // Normaliza itens pedidos (variacaoId → quantidade), ignora duplicatas/qtd inválida
    const qtdPorVar = new Map<string, number>()
    for (const it of itensReq) {
      const vid = String(it?.variacaoId || '')
      const q = Math.max(0, Math.floor(Number(it?.quantidade) || 0))
      if (vid && q > 0) qtdPorVar.set(vid, (qtdPorVar.get(vid) || 0) + q)
    }
    if (qtdPorVar.size === 0) return NextResponse.json({ error: 'Carrinho inválido.' }, { status: 400 })

    // Busca no servidor SÓ variações válidas do catálogo desta loja (preço confiável)
    const ids = Array.from(qtdPorVar.keys())
    const validos = await prisma.$queryRaw`
      SELECT v."id" AS "variacaoId", p."nome" AS "produtoNome",
             v."tipo", v."subOpcao", v."nome" AS "variacaoNome", v."isKit", v."qtdKit",
             COALESCE(v."precoVenda", 0)::float       AS "precoVenda",
             COALESCE(v."emPromo", false)             AS "emPromo",
             COALESCE(v."precoPromocional", 0)::float AS "precoPromocional"
      FROM "PrecVariacao" v
      JOIN "PrecProduto" p ON p."id" = v."produtoId"
      LEFT JOIN "EstProdutoSaldo" s ON s."variacaoId" = v."id" AND s."workspaceId" = ${workspaceId}
      WHERE v."id" = ANY(${ids}::text[])
        AND p."workspaceId" = ${workspaceId}
        AND p."ativo" = true
        AND COALESCE(v."precoVenda", 0) > 0
        AND (p."visivelLoja" = true OR (v."incluirEstoque" = true AND COALESCE(s."saldoAtual", 0) > 0))
    ` as any[]

    if (validos.length === 0)
      return NextResponse.json({ error: 'Nenhum item do carrinho está disponível.' }, { status: 400 })

    let subtotal = 0
    let qtdTotal = 0
    const produtos = validos.map((v: any) => {
      const emPromo = !!v.emPromo && Number(v.precoPromocional) > 0
      const preco = emPromo ? Number(v.precoPromocional) : Number(v.precoVenda)
      const q = qtdPorVar.get(v.variacaoId) || 1
      const label = (v.variacaoNome && String(v.variacaoNome).trim())
        || [v.tipo, v.subOpcao].filter((x: any) => x && x !== 'Padrão').join(' · ')
      subtotal += preco * q
      qtdTotal += (v.isKit && v.qtdKit ? Number(v.qtdKit) : 1) * q
      return {
        nome: label ? `${v.produtoNome} — ${label}` : v.produtoNome,
        quantidade: q,
        valorUnitario: preco,
        variacaoId: v.variacaoId,
        isKit: !!v.isKit,
        qtdKitPecas: Number(v.qtdKit) || 0,
      }
    })

    // Frete server-side conforme a config da loja
    let frete = 0
    if (entrega && loja.freteTipo === 'fixo') frete = Number(loja.freteValor) || 0
    const valorTotal = subtotal + frete

    // ── Casa ou cria o Cliente ────────────────────────────────────────
    const tel = soDigitos(telefone)
    const existentes = await prisma.$queryRaw`
      SELECT "id","nome","telefone" FROM "Cliente"
      WHERE "workspaceId" = ${workspaceId} AND "ativo" = true
    ` as { id: string; nome: string; telefone: string | null }[]
    const mesmoNome = existentes.filter(c => normNome(c.nome) === normNome(nome))
    let clienteId: string | null = null
    if (mesmoNome.length === 1) clienteId = mesmoNome[0].id
    else if (mesmoNome.length > 1) {
      const porTel = mesmoNome.filter(c => soDigitos(c.telefone) === tel)
      if (porTel.length === 1) clienteId = porTel[0].id
    }
    if (!clienteId) {
      clienteId = novoId()
      await prisma.$executeRaw`
        INSERT INTO "Cliente"
          ("id","workspaceId","nome","telefone","origem","ativo","createdAt","updatedAt")
        VALUES (${clienteId}, ${workspaceId}, ${nome}, ${telefone || null}, 'Loja Virtual', true, NOW(), NOW())
      `
    }

    // ── Cria o Order (canal "Loja", status ABERTO) ────────────────────
    const pedidoId = novoId()
    const numero = 'LOJ-' + Date.now().toString(36).toUpperCase()
    const produtoTexto = produtos.map(p => `${p.nome}${p.quantidade > 1 ? ` (${p.quantidade}x)` : ''}`).join(' + ')
    const camposExtras = {
      produtos,
      loja: { slug, entrega: entrega ? 'entrega' : 'retirada', frete },
    }
    const obsFinal = [
      observacoes || null,
      `Pedido pela Loja Virtual · ${entrega ? 'Entrega' : 'Retirada'}${frete > 0 ? ` · Frete R$ ${frete.toFixed(2)}` : ''}`,
    ].filter(Boolean).join(' | ')

    await prisma.$executeRaw`
      INSERT INTO "Order" (
        "id","workspaceId","numero","destinatario","idCliente","clienteId",
        "canal","produto","quantidade","quantidadeSku","valor",
        "dataEntrada","observacoes","prioridade","status","endereco","camposExtras"
      ) VALUES (
        ${pedidoId}, ${workspaceId}, ${numero}, ${nome}, ${null}, ${clienteId},
        'Loja', ${produtoTexto}, ${qtdTotal}, ${produtos.length}, ${valorTotal},
        NOW(), ${obsFinal || null}, 'NORMAL', 'ABERTO',
        ${entrega ? endereco : null}, ${JSON.stringify(camposExtras)}
      )
    `

    return NextResponse.json({ ok: true, numero, subtotal, frete, total: valorTotal })
  } catch (e) {
    console.error('[LOJA PEDIDO]', e)
    return NextResponse.json({ error: 'Erro ao enviar o pedido. Tente novamente.' }, { status: 500 })
  }
}
