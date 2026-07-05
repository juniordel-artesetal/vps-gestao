import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { gerarBRCode } from '@/lib/pagamento/pix'
import { criarPagamentoPix } from '@/lib/pagamento/mercadopago'
import { metodosDisponiveis } from '@/lib/pagamento'

export const dynamic = 'force-dynamic'

function novoId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

const HITS = new Map<string, number[]>()
function rateLimited(chave: string, max = 12, janelaMs = 60_000): boolean {
  const agora = Date.now()
  const arr = (HITS.get(chave) || []).filter(t => agora - t < janelaMs)
  arr.push(agora); HITS.set(chave, arr)
  return arr.length > max
}

// POST público — inicia a cobrança de um pedido (valor SEMPRE do servidor) OU
// recebe o comprovante. Nunca expõe credencial/dados de outro workspace.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const ip = (req.headers.get('x-forwarded-for') || 'anon').split(',')[0].trim()
    if (rateLimited(`${slug}:${ip}`)) return NextResponse.json({ error: 'Muitas tentativas. Aguarde.' }, { status: 429 })

    const [loja] = await prisma.$queryRaw`
      SELECT lc."workspaceId",
             pc."pixChave", pc."pixNome", pc."pixCidade", pc."linkPagamento",
             pc."provedor", pc."provedorAtivo", pc."credencial", pc."metodos"
      FROM "LojaConfig" lc
      LEFT JOIN "LojaPagamentoConfig" pc ON pc."workspaceId" = lc."workspaceId"
      WHERE lc."slug" = ${slug} AND lc."ativo" = true
      LIMIT 1
    ` as any[]
    if (!loja) return NextResponse.json({ error: 'Loja indisponível' }, { status: 404 })

    const workspaceId: string = loja.workspaceId
    const body = await req.json().catch(() => ({}))
    const numero = String(body?.numero || '').trim()
    if (!numero) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })

    // Localiza o pedido DESTA loja (isolamento). Valor vem daqui (servidor).
    const [ord] = await prisma.$queryRaw`
      SELECT "id","numero","valor"::float AS "valor","destinatario","statusPagamento"
      FROM "Order"
      WHERE "numero" = ${numero} AND "workspaceId" = ${workspaceId} AND "canal" = 'Loja'
      LIMIT 1
    ` as any[]
    if (!ord) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    if (ord.statusPagamento === 'pago') return NextResponse.json({ error: 'Pedido já pago', jaPago: true }, { status: 400 })

    // ── Comprovante (PIX-chave/link: confirmação manual) ──
    if (body.comprovante !== undefined) {
      const comp = body.comprovante ? String(body.comprovante) : null
      await prisma.$executeRaw`
        UPDATE "Order" SET "comprovante" = ${comp}, "statusPagamento" = 'aguardando'
        WHERE "id" = ${ord.id} AND "workspaceId" = ${workspaceId}
      `
      return NextResponse.json({ ok: true, comprovante: true })
    }

    // ── Inicia cobrança por método ──
    const metodo = String(body?.metodo || '')
    const disponiveis = metodosDisponiveis(loja)
    if (!disponiveis.includes(metodo as any)) return NextResponse.json({ error: 'Método de pagamento indisponível' }, { status: 400 })

    const valor = Number(ord.valor) || 0

    if (metodo === 'pix') {
      const copiaECola = gerarBRCode({ chave: loja.pixChave, nome: loja.pixNome || ord.destinatario || 'Recebedor', cidade: loja.pixCidade || 'Cidade', valor, txid: numero })
      await prisma.$executeRaw`UPDATE "Order" SET "metodoPagamento"='pix', "statusPagamento"='aguardando' WHERE "id"=${ord.id} AND "workspaceId"=${workspaceId}`
      return NextResponse.json({ ok: true, tipo: 'pix', copiaECola, valor })
    }

    if (metodo === 'link') {
      await prisma.$executeRaw`UPDATE "Order" SET "metodoPagamento"='link', "statusPagamento"='aguardando' WHERE "id"=${ord.id} AND "workspaceId"=${workspaceId}`
      return NextResponse.json({ ok: true, tipo: 'link', url: loja.linkPagamento, valor })
    }

    if (metodo === 'mercadopago') {
      const mp = await criarPagamentoPix(loja.credencial, { valor, descricao: `Pedido ${numero}`, ref: ord.id })
      // Registra o pagamento (idempotência por provedor+ref)
      await prisma.$executeRaw`
        INSERT INTO "Pagamento" ("id","workspaceId","orderId","provedor","valor","status","ref","createdAt")
        VALUES (${novoId()}, ${workspaceId}, ${ord.id}, 'mercadopago', ${valor}, 'aguardando', ${mp.id}, NOW())
        ON CONFLICT ("provedor","ref") DO NOTHING
      `
      await prisma.$executeRaw`UPDATE "Order" SET "metodoPagamento"='mercadopago', "pagamentoRef"=${mp.id}, "statusPagamento"='aguardando' WHERE "id"=${ord.id} AND "workspaceId"=${workspaceId}`
      return NextResponse.json({ ok: true, tipo: 'mercadopago', copiaECola: mp.copiaECola, qrBase64: mp.qrBase64, valor })
    }

    return NextResponse.json({ error: 'Método inválido' }, { status: 400 })
  } catch (e: any) {
    console.error('[LOJA PAGAMENTO]', e)
    return NextResponse.json({ error: e?.message || 'Erro ao iniciar pagamento' }, { status: 500 })
  }
}
