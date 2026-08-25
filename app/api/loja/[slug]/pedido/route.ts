import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normNome, soDigitos } from '@/lib/normNome'
import { metodosDisponiveis } from '@/lib/pagamento'
import { expandirCombo, pecasDoCombo } from '@/lib/comboExpandir'
import { ensureComboLoja } from '@/lib/precComboLoja'

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
      SELECT lc."workspaceId", lc."freteTipo", lc."freteValor"::float AS "freteValor",
             pc."pixChave", pc."linkPagamento", pc."provedor", pc."provedorAtivo",
             pc."credencial", pc."metodos"
      FROM "LojaConfig" lc
      LEFT JOIN "LojaPagamentoConfig" pc ON pc."workspaceId" = lc."workspaceId"
      WHERE lc."slug" = ${slug} AND lc."ativo" = true LIMIT 1
    ` as any[]
    if (!loja) return NextResponse.json({ error: 'Loja indisponível' }, { status: 404 })

    const workspaceId: string = loja.workspaceId
    const temPagamento = metodosDisponiveis(loja).length > 0
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

    // Separa variações e COMBOS (id sintético "combo:<id>") — preço sempre server-side.
    const ids = Array.from(qtdPorVar.keys())
    const idsVar = ids.filter(id => !id.startsWith('combo:'))
    const idsCombo = ids.filter(id => id.startsWith('combo:')).map(id => id.slice('combo:'.length))

    const validos = idsVar.length ? await prisma.$queryRaw`
      SELECT v."id" AS "variacaoId", p."nome" AS "produtoNome",
             v."tipo", v."subOpcao", v."nome" AS "variacaoNome", v."isKit", v."qtdKit",
             COALESCE(v."precoVenda", 0)::float       AS "precoVenda",
             COALESCE(v."emPromo", false)             AS "emPromo",
             COALESCE(v."precoPromocional", 0)::float AS "precoPromocional"
      FROM "PrecVariacao" v
      JOIN "PrecProduto" p ON p."id" = v."produtoId"
      LEFT JOIN "EstProdutoSaldo" s ON s."variacaoId" = v."id" AND s."workspaceId" = ${workspaceId}
      WHERE v."id" = ANY(${idsVar}::text[])
        AND p."workspaceId" = ${workspaceId}
        AND p."ativo" = true
        AND COALESCE(v."precoVenda", 0) > 0
        AND (p."visivelLoja" = true OR (v."incluirEstoque" = true AND COALESCE(s."saldoAtual", 0) > 0))
    ` as any[] : []

    // Combos publicados na loja: preço confiável (precoCombo) + componentes p/ produção/estoque.
    let combosValidos: any[] = []
    if (idsCombo.length) {
      await ensureComboLoja()
      combosValidos = await prisma.$queryRaw`
        SELECT c."id", c."nome", COALESCE(c."precoCombo",0)::float AS "precoCombo",
          COALESCE(JSON_AGG(JSON_BUILD_OBJECT('nomeProduto', ci."nomeProduto", 'qtd', ci."qtd", 'variacaoId', ci."variacaoId"))
            FILTER (WHERE ci."id" IS NOT NULL), '[]') AS items
        FROM "PrecCombo" c LEFT JOIN "PrecComboItem" ci ON ci."comboId" = c."id"
        WHERE c."id" = ANY(${idsCombo}::text[]) AND c."workspaceId" = ${workspaceId}
          AND c."ativo" = true AND c."visivelLoja" = true AND COALESCE(c."precoCombo",0) > 0
        GROUP BY c."id"
      ` as any[]
    }

    if (validos.length === 0 && combosValidos.length === 0)
      return NextResponse.json({ error: 'Nenhum item do carrinho está disponível.' }, { status: 400 })

    let subtotal = 0
    let qtdTotal = 0
    const produtos: any[] = validos.map((v: any) => {
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

    // Combos: 1 linha de PREÇO (precoCombo) + componentes (valor 0) p/ produção e estoque.
    for (const c of combosValidos) {
      const items = Array.isArray(c.items) ? c.items : (() => { try { return JSON.parse(c.items) } catch { return [] } })()
      const q = qtdPorVar.get(`combo:${c.id}`) || 1
      subtotal += Number(c.precoCombo) * q
      qtdTotal += pecasDoCombo({ items }, q)
      for (const linha of expandirCombo({ nome: c.nome, precoCombo: Number(c.precoCombo), items }, q)) {
        produtos.push({ nome: linha.nome, quantidade: linha.quantidade, valorUnitario: linha.valorUnitario ?? 0, variacaoId: linha.variacaoId ?? null, isKit: false, qtdKitPecas: 0 })
      }
    }

    // ── Estoque: valida saldo dos itens a pronta entrega (rastreados) ──
    const idsPedido = produtos.map(pp => pp.variacaoId).filter(Boolean)
    const rastreadas = await prisma.$queryRaw`
      SELECT v."id" AS "variacaoId", COALESCE(s."saldoAtual", 0)::int AS "saldo"
      FROM "PrecVariacao" v
      JOIN "PrecProduto" p ON p."id" = v."produtoId"
      LEFT JOIN "EstProdutoSaldo" s ON s."variacaoId" = v."id" AND s."workspaceId" = ${workspaceId}
      WHERE v."id" = ANY(${idsPedido}::text[]) AND p."workspaceId" = ${workspaceId} AND v."incluirEstoque" = true
    ` as { variacaoId: string; saldo: number }[]
    const saldoPorVar = new Map(rastreadas.map(r => [r.variacaoId, Number(r.saldo)]))
    const semEstoque = produtos.filter(pp => saldoPorVar.has(pp.variacaoId) && saldoPorVar.get(pp.variacaoId)! < pp.quantidade).map(pp => pp.nome)
    if (semEstoque.length > 0)
      return NextResponse.json({ error: `Sem estoque suficiente: ${semEstoque.join(', ')}. Ajuste o carrinho.` }, { status: 409 })

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

    const statusPagamento = temPagamento ? 'aguardando' : 'nao_aplicavel'
    await prisma.$executeRaw`
      INSERT INTO "Order" (
        "id","workspaceId","numero","destinatario","idCliente","clienteId",
        "canal","produto","quantidade","quantidadeSku","valor",
        "dataEntrada","observacoes","prioridade","status","endereco","camposExtras",
        "statusPagamento"
      ) VALUES (
        ${pedidoId}, ${workspaceId}, ${numero}, ${nome}, ${null}, ${clienteId},
        'Loja', ${produtoTexto}, ${qtdTotal}, ${produtos.length}, ${valorTotal},
        NOW(), ${obsFinal || null}, 'NORMAL', 'ABERTO',
        ${entrega ? endereco : null}, ${JSON.stringify(camposExtras)},
        ${statusPagamento}
      )
    `

    // ── Baixa automática no estoque (itens a pronta entrega) ──
    // Decremento guardado (saldoAtual >= qtd) evita saldo negativo em corrida;
    // registra movimento SAIDA para auditoria. Não derruba o pedido em caso de falha.
    for (const pp of produtos) {
      if (!saldoPorVar.has(pp.variacaoId)) continue
      const qtd = pp.quantidade
      try {
        const upd = await prisma.$executeRaw`
          UPDATE "EstProdutoSaldo" SET "saldoAtual" = "saldoAtual" - ${qtd}, "updatedAt" = NOW()
          WHERE "workspaceId" = ${workspaceId} AND "variacaoId" = ${pp.variacaoId} AND "saldoAtual" >= ${qtd}
        `
        if (Number(upd) > 0) {
          const saldoApos = (saldoPorVar.get(pp.variacaoId) || 0) - qtd
          await prisma.$executeRaw`
            INSERT INTO "EstProdutoMovimento"
              ("id","workspaceId","variacaoId","tipo","quantidade","saldoApos","motivo","referencia","usuarioNome")
            VALUES (${novoId()}, ${workspaceId}, ${pp.variacaoId}, 'SAIDA', ${qtd}, ${saldoApos}, 'Venda pela Loja Virtual', ${numero}, 'Loja Virtual')
          `
        }
      } catch (eBaixa) { console.error('[LOJA baixa estoque]', eBaixa) }
    }

    // ── Financeiro: lança a RECEITA (previsto) no caixa — canal "Loja" ──
    // A venda pela loja tem que entrar em "a receber" na hora (bug: entrava só como
    // pedido, sem tocar o caixa). Espelha o padrão dos canais manuais: PENDENTE pelo
    // total, data = data do pedido, vinculado ao cliente. A baixa p/ recebido segue o
    // fluxo normal do financeiro. Idempotente por referência (não duplica).
    try {
      if (valorTotal > 0) {
        const jaTem = await prisma.$queryRaw`
          SELECT 1 FROM "FinLancamento"
          WHERE "workspaceId" = ${workspaceId} AND "referencia" = ${numero} AND "canal" = 'Loja' LIMIT 1
        ` as any[]
        if (jaTem.length === 0) {
          await prisma.$executeRaw`
            INSERT INTO "FinLancamento"
              ("id","workspaceId","tipo","categoriaId","descricao","valor","data","status",
               "dataRealizada","valorRealizado","canal","referencia","observacoes","clienteId")
            VALUES (
              ${novoId()}, ${workspaceId}, 'RECEITA', NULL,
              ${`[loja-auto] Pedido #${numero} — Loja`}, ${valorTotal}, NOW()::date, 'PENDENTE',
              NULL, NULL, 'Loja', ${numero}, '[loja-auto]', ${clienteId}
            )
          `
        }
      }
    } catch (eLanc) { console.error('[LOJA lançamento]', eLanc) }

    return NextResponse.json({ ok: true, numero, subtotal, frete, total: valorTotal })
  } catch (e) {
    console.error('[LOJA PEDIDO]', e)
    return NextResponse.json({ error: 'Erro ao enviar o pedido. Tente novamente.' }, { status: 500 })
  }
}
