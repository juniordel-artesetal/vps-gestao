import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

// Parse seguro de datas: "2026-04-29" → adiciona T12:00:00 para evitar bug de timezone
// Sem isso, new Date("2026-04-29") = UTC meia-noite = dia anterior no Brasil (UTC-3)
function parseDate(val: string | null | undefined): Date | null {
  if (!val) return null
  // Se já tem horário (ISO completo), usa direto
  if (val.includes('T')) return new Date(val)
  // Só data: adiciona meio-dia para garantir o dia correto em qualquer timezone
  return new Date(val + 'T12:00:00.000Z')
}

// GET — busca pedido por ID
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    const rows = await prisma.$queryRaw`
      SELECT
        o."id",
        o."numero",
        o."destinatario",
        o."idCliente",
        o."canal",
        o."produto",
        o."quantidade"::int,
        o."valor",
        o."dataEntrada",
        o."dataEnvio",
        o."observacoes",
        o."prioridade",
        o."status",
        o."endereco",
        o."camposExtras",
        o."createdAt",
        o."updatedAt",
        s."nome"  AS "setor_atual_nome",
        s."id"    AS "setor_atual_id"
      FROM "Order" o
      LEFT JOIN "PedidoSetorAtual" psa ON psa."pedidoId" = o."id"
      LEFT JOIN "Setor" s ON s."id" = psa."setorId"
      WHERE o."id" = ${id}
        AND o."workspaceId" = ${workspaceId}
      LIMIT 1
    ` as any[]

    if (rows.length === 0)
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

    return NextResponse.json({ pedido: serialize(rows[0]) })
  } catch (error) {
    console.error('[GET pedido/id]', error)
    // Fallback: tenta sem a view PedidoSetorAtual
    try {
      const session = await getServerSession(authOptions)
      if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
      const { id } = await params
      const workspaceId = session.user.workspaceId

      const rows = await prisma.$queryRaw`
        SELECT
          o."id", o."numero", o."destinatario", o."idCliente", o."canal",
          o."produto", o."quantidade"::int, o."valor", o."dataEntrada",
          o."dataEnvio", o."observacoes", o."prioridade", o."status",
          o."endereco", o."camposExtras", o."createdAt", o."updatedAt",
          NULL AS "setor_atual_nome", NULL AS "setor_atual_id"
        FROM "Order" o
        WHERE o."id" = ${id} AND o."workspaceId" = ${workspaceId}
        LIMIT 1
      ` as any[]

      if (rows.length === 0)
        return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

      return NextResponse.json({ pedido: serialize(rows[0]) })
    } catch (e2) {
      return NextResponse.json({ error: String(e2) }, { status: 500 })
    }
  }
}

// PUT — atualiza pedido
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId
    const body = await req.json()

    // Verifica pertencimento
    const check = await prisma.$queryRaw`
      SELECT "id" FROM "Order"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
      LIMIT 1
    ` as any[]

    if (check.length === 0)
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

    const {
      numero, destinatario, idCliente, canal, produto,
      quantidade, valor, dataEntrada, dataEnvio,
      observacoes, prioridade, status, endereco, camposExtras,
      responsavelId, dataEnvioMassa,
    } = body

    // Atualiza campos enviados
    if (numero      !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "numero"       = ${numero}             WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (destinatario !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "destinatario" = ${destinatario}       WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (idCliente   !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "idCliente"    = ${idCliente || null}  WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (canal       !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "canal"        = ${canal || null}      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (produto     !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "produto"      = ${produto}            WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (quantidade  !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "quantidade"   = ${parseInt(quantidade) || 1} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (valor       !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "valor"        = ${valor ? parseFloat(valor) : null} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (dataEntrada !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "dataEntrada"  = ${parseDate(dataEntrada)} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (dataEnvio   !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "dataEnvio"    = ${parseDate(dataEnvio)}     WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (observacoes !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "observacoes"  = ${observacoes || null} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (prioridade  !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "prioridade"   = ${prioridade}          WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (status      !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "status"       = ${status}              WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (endereco    !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "endereco"     = ${endereco || null}    WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (responsavelId !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "responsavelId" = ${responsavelId || null} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`

    // dataEnvio via massa
    if (dataEnvioMassa !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "dataEnvio" = ${parseDate(dataEnvioMassa)} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`

    // camposExtras: aceita objeto ou string JSON
    if (camposExtras !== undefined) {
      const extrasStr = camposExtras === null ? null
        : typeof camposExtras === 'string' ? camposExtras
        : JSON.stringify(camposExtras)
      await prisma.$executeRaw`UPDATE "Order" SET "camposExtras" = ${extrasStr} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    }

    // Timestamp de atualização
    await prisma.$executeRaw`UPDATE "Order" SET "updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[PUT pedido/id]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// DELETE — remove pedido
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    await prisma.$executeRaw`
      DELETE FROM "Order" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
