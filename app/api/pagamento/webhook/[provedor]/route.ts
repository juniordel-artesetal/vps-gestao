import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { consultarProvedor } from '@/lib/pagamento'

export const dynamic = 'force-dynamic'

const HITS = new Map<string, number[]>()
function rateLimited(chave: string, max = 60, janelaMs = 60_000): boolean {
  const agora = Date.now()
  const arr = (HITS.get(chave) || []).filter(t => agora - t < janelaMs)
  arr.push(agora); HITS.set(chave, arr)
  return arr.length > max
}

// Extrai o id do pagamento da notificação (query e/ou corpo) — vários formatos do MP.
function extrairPaymentId(url: URL, body: any): string | null {
  const q = url.searchParams
  const cand = [
    q.get('data.id'), q.get('id'),
    body?.data?.id, body?.id,
  ].filter(Boolean).map(String)
  if (cand.length) return cand[0]
  // formato antigo: resource = url terminando no id
  const resource = body?.resource
  if (typeof resource === 'string') { const m = resource.match(/(\d+)\/?$/); if (m) return m[1] }
  return null
}

// POST público — notificação do provedor. NUNCA confia no corpo:
// re-consulta a API do provedor (com o token do workspace) e confirma o status.
// Idempotente: mesma notificação não marca pago duas vezes.
export async function POST(req: Request, { params }: { params: Promise<{ provedor: string }> }) {
  try {
    const { provedor } = await params
    const ip = (req.headers.get('x-forwarded-for') || 'anon').split(',')[0].trim()
    if (rateLimited(`${provedor}:${ip}`)) return new NextResponse(null, { status: 429 })

    const url = new URL(req.url)
    const body = await req.json().catch(() => ({}))
    const paymentId = extrairPaymentId(url, body)
    // Sempre 200 para o provedor parar de reenviar, mesmo quando ignoramos.
    if (!paymentId) return NextResponse.json({ ok: true, ignorado: 'sem id' })

    // Só processamos pagamentos que NÓS criamos (ref na nossa tabela) — evita forja.
    const [pag] = await prisma.$queryRaw`
      SELECT "id","workspaceId","orderId","status","valor"::float AS "valor"
      FROM "Pagamento"
      WHERE "provedor" = ${provedor} AND "ref" = ${paymentId}
      LIMIT 1
    ` as any[]
    if (!pag) return NextResponse.json({ ok: true, ignorado: 'nao encontrado' })

    // Idempotência: já pago → nada a fazer.
    if (pag.status === 'pago') return NextResponse.json({ ok: true, jaPago: true })

    // Credencial do workspace (server-side; nunca exposta).
    const [cfg] = await prisma.$queryRaw`
      SELECT "credencial" FROM "LojaPagamentoConfig" WHERE "workspaceId" = ${pag.workspaceId} LIMIT 1
    ` as any[]
    if (!cfg?.credencial) return NextResponse.json({ ok: true, ignorado: 'sem credencial' })

    // FONTE DA VERDADE: re-consulta a API do provedor.
    let status: string
    try {
      const r = await consultarProvedor(provedor, cfg.credencial, paymentId)
      status = r.status
    } catch (e) {
      console.error('[WEBHOOK consulta]', e)
      return NextResponse.json({ ok: true, pendente: 'consulta falhou' }) // não marca sem confirmar
    }

    if (status === 'pago') {
      // Idempotente: só marca se ainda não estava pago.
      await prisma.$executeRaw`
        UPDATE "Pagamento" SET "status" = 'pago' WHERE "id" = ${pag.id} AND "status" <> 'pago'
      `
      await prisma.$executeRaw`
        UPDATE "Order" SET "statusPagamento" = 'pago', "pagoEm" = NOW()
        WHERE "id" = ${pag.orderId} AND "workspaceId" = ${pag.workspaceId} AND "statusPagamento" <> 'pago'
      `
      return NextResponse.json({ ok: true, pago: true })
    }
    if (status === 'cancelado') {
      await prisma.$executeRaw`UPDATE "Pagamento" SET "status" = 'cancelado' WHERE "id" = ${pag.id} AND "status" <> 'pago'`
    }
    return NextResponse.json({ ok: true, status })
  } catch (e) {
    console.error('[WEBHOOK]', e)
    return new NextResponse(null, { status: 200 }) // não deixa o provedor martelar em erro
  }
}
