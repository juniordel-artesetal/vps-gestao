// NF-e do pedido TikTok (BR): a artesã anexa o XML da nota AUTORIZADA; o SOA guarda e, se o pedido
// já foi expedido, sobe ao TikTok e tenta o aviso de envio na hora (fail-open). ADMIN, por workspace.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validarXmlNfe } from '@/lib/tiktok/nfe'
import { dispararFulfillmentTikTok } from '@/lib/tiktok/fulfillment'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId

  const body = await req.json().catch(() => ({}))
  const orderId = String(body?.orderId ?? '')
  const xml = String(body?.xml ?? '')
  if (!orderId) return NextResponse.json({ error: 'orderId obrigatório' }, { status: 400 })
  const v = validarXmlNfe(xml)
  if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 })

  const [pm] = await prisma.$queryRaw`
    SELECT pm."id", o."status" FROM "PedidoMarketplace" pm JOIN "Order" o ON o."id" = pm."orderId"
    WHERE pm."orderId" = ${orderId} AND pm."workspaceId" = ${workspaceId} AND o."workspaceId" = ${workspaceId} AND pm."canal" = 'tiktokshop' LIMIT 1
  ` as { id: string; status: string }[]
  if (!pm) return NextResponse.json({ error: 'Pedido do TikTok não encontrado' }, { status: 404 })

  // Mesma chave já usada em outro pedido → o TikTok recusa (ACCESS_KEY_DUPLICATE); avisa antes.
  const [dup] = await prisma.$queryRaw`
    SELECT 1 AS x FROM "PedidoMarketplace" WHERE "workspaceId" = ${workspaceId} AND "nfeChave" = ${v.chave} AND "id" <> ${pm.id} LIMIT 1
  ` as { x: number }[]
  if (dup) return NextResponse.json({ error: 'Essa NF-e já está anexada em outro pedido.' }, { status: 409 })

  // XML novo zera o resultado anterior (uma nota recusada pode ser trocada pela corrigida).
  await prisma.$executeRaw`
    UPDATE "PedidoMarketplace" SET "nfeXml" = ${xml.trim()}, "nfeChave" = ${v.chave}, "nfeStatus" = NULL, "nfeErro" = NULL,
      "fulfillmentStatus" = CASE WHEN "fulfillmentStatus" = 'falta_nf' THEN 'pendente' ELSE "fulfillmentStatus" END, "updatedAt" = NOW()
    WHERE "id" = ${pm.id} AND "workspaceId" = ${workspaceId}
  `
  // Já expedido no SOA → sobe a nota e tenta o aviso de envio agora.
  if (pm.status === 'ENVIADO') await dispararFulfillmentTikTok(workspaceId, orderId)
  return NextResponse.json({ ok: true, chave: v.chave, enviadoAoTikTok: pm.status === 'ENVIADO' })
}
