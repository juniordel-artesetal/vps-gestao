import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// GET — lista pedidos com filtros
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status    = searchParams.get('status')
    const prioridade = searchParams.get('prioridade')
    const canal     = searchParams.get('canal')
    const busca     = searchParams.get('busca')
    const pagina    = parseInt(searchParams.get('pagina') || '1')
    const limite    = parseInt(searchParams.get('limite') || '20')
    const offset    = (pagina - 1) * limite

    const workspaceId = session.user.workspaceId

    const pedidos = await prisma.$queryRaw`
      SELECT
        o.*,
        (SELECT COUNT(*) FROM "WorkItem" wi WHERE wi."orderId" = o."id") as total_itens,
        (SELECT COUNT(*) FROM "WorkItem" wi WHERE wi."orderId" = o."id" AND wi."status" = 'CONCLUIDO') as itens_concluidos
      FROM "Order" o
      WHERE o."workspaceId" = ${workspaceId}
        AND (${status}::text IS NULL OR o."status" = ${status})
        AND (${prioridade}::text IS NULL OR o."prioridade" = ${prioridade})
        AND (${canal}::text IS NULL OR o."canal" = ${canal})
        AND (${busca}::text IS NULL OR
             o."numero" ILIKE ${'%' + (busca || '') + '%'} OR
             o."destinatario" ILIKE ${'%' + (busca || '') + '%'} OR
             o."produto" ILIKE ${'%' + (busca || '') + '%'}
        )
      ORDER BY
        CASE o."prioridade"
          WHEN 'URGENTE' THEN 1
          WHEN 'ALTA'    THEN 2
          WHEN 'NORMAL'  THEN 3
          WHEN 'BAIXA'   THEN 4
          ELSE 5
        END,
        o."createdAt" DESC
      LIMIT ${limite} OFFSET ${offset}
    ` as any[]

    const [contagem] = await prisma.$queryRaw`
      SELECT COUNT(*) as total
      FROM "Order"
      WHERE "workspaceId" = ${workspaceId}
        AND (${status}::text IS NULL OR "status" = ${status})
        AND (${prioridade}::text IS NULL OR "prioridade" = ${prioridade})
        AND (${canal}::text IS NULL OR "canal" = ${canal})
    ` as any[]

    return NextResponse.json({
      pedidos,
      total: Number(contagem.total),
      pagina,
      limite,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — cria novo pedido
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const body = await req.json()
    const {
      numero, destinatario, idCliente, canal, produto,
      quantidade, valor, dataEntrada, dataEnvio,
      observacoes, prioridade,
    } = body

    if (!numero || !destinatario || !produto) {
      return NextResponse.json({ error: 'Número, destinatário e produto são obrigatórios' }, { status: 400 })
    }

    const workspaceId = session.user.workspaceId
    const id = gerarId()

    await prisma.$executeRaw`
      INSERT INTO "Order" (
        "id", "workspaceId", "numero", "destinatario", "idCliente",
        "canal", "produto", "quantidade", "valor",
        "dataEntrada", "dataEnvio", "observacoes", "prioridade", "status"
      ) VALUES (
        ${id}, ${workspaceId}, ${numero}, ${destinatario}, ${idCliente ?? null},
        ${canal ?? null}, ${produto}, ${quantidade ?? 1}, ${valor ?? null},
        ${dataEntrada ?? null}, ${dataEnvio ?? null}, ${observacoes ?? null},
        ${prioridade ?? 'NORMAL'}, 'ABERTO'
      )
    `

    const novos = await prisma.$queryRaw`
      SELECT * FROM "Order" WHERE "id" = ${id}
    ` as any[]

    return NextResponse.json({ pedido: novos[0] })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
