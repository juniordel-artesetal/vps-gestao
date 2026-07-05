import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET — comprovante do pedido (imagem). ADMIN, isolado por workspace.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR') return new NextResponse(null, { status: 403 })

  const { id } = await params
  const [row] = await prisma.$queryRaw`
    SELECT "comprovante" FROM "Order" WHERE "id" = ${id} AND "workspaceId" = ${session.user.workspaceId} LIMIT 1
  ` as { comprovante: string | null }[]

  const dataUrl = row?.comprovante
  if (!dataUrl) return new NextResponse(null, { status: 404 })
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return new NextResponse(null, { status: 404 })
  const bytes = new Uint8Array(Buffer.from(m[2], 'base64'))
  return new NextResponse(bytes, { status: 200, headers: { 'Content-Type': m[1], 'Content-Length': String(bytes.length), 'Cache-Control': 'private, max-age=30' } })
}

// PUT — marca/desmarca pagamento manualmente. ADMIN, isolado por workspace.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId
  const { status } = await req.json()
  const novo = status === 'pago' ? 'pago' : 'aguardando'

  if (novo === 'pago') {
    await prisma.$executeRaw`
      UPDATE "Order" SET "statusPagamento" = 'pago', "pagoEm" = NOW()
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `
  } else {
    await prisma.$executeRaw`
      UPDATE "Order" SET "statusPagamento" = 'aguardando', "pagoEm" = NULL
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `
  }
  return NextResponse.json({ ok: true, statusPagamento: novo })
}
