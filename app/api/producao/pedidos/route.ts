import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function toDate(val: string | null | undefined) {
  if (!val) return null
  return new Date(val)
}

// FIX B6: adicionado branch para Prisma Decimal antes do branch genérico
// de objeto. Decimal tem o método toNumber() — usamos ele para converter.
// Sem isso, serialize() entrava no branch 'object' e serializava as
// propriedades internas {d, e, s} do Decimal, resultando em valor inútil.
function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  // Prisma Decimal (e qualquer objeto com toNumber)
  if (typeof obj === 'object' && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') {
    const result: any = {}
    for (const key of Object.keys(obj)) result[key] = serialize(obj[key])
    return result
  }
  return obj
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status      = searchParams.get('status')
    const prioridade  = searchParams.get('prioridade')
    const canal       = searchParams.get('canal')
    const setorId     = searchParams.get('setorId')
    const busca       = searchParams.get('busca')
    const pagina      = parseInt(searchParams.get('pagina') || '1')
    const limite      = parseInt(searchParams.get('limite') || '20')
    const offset      = (pagina - 1) * limite
    const workspaceId = session.user.workspaceId
    const buscaLike   = busca ? `%${busca}%` : null

    const pedidos = await prisma.$queryRaw`
      SELECT
        o."id", o."numero", o."destinatario", o."idCliente", o."canal",
        o."produto", o."quantidade", o."valor", o."prioridade", o."status",
        o."dataEntrada", o."dataEnvio", o."observacoes", o."endereco",
        o."camposExtras", o."createdAt", o."updatedAt",
        psa."setorNome" as setor_atual_nome,
        psa."setorId"   as setor_atual_id,
        (SELECT COUNT(*) FROM "PedidoSetor" ps WHERE ps."pedidoId" = o."id") as total_itens,
        (SELECT COUNT(*) FROM "PedidoSetor" ps WHERE ps."pedidoId" = o."id" AND ps."status" = 'CONCLUIDO') as itens_concluidos
      FROM "Order" o
      LEFT JOIN "PedidoSetorAtual" psa ON psa."pedidoId" = o."id"
      WHERE o."workspaceId" = ${workspaceId}
        AND (${status}::text IS NULL OR o."status" = ${status})
        AND (${prioridade}::text IS NULL OR o."prioridade" = ${prioridade})
        AND (${canal}::text IS NULL OR o."canal" = ${canal})
        AND (${setorId}::text IS NULL OR psa."setorId" = ${setorId})
        AND (${buscaLike}::text IS NULL OR
             o."numero"       ILIKE ${buscaLike} OR
             o."destinatario" ILIKE ${buscaLike} OR
             o."produto"      ILIKE ${buscaLike}
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
      FROM "Order" o
      LEFT JOIN "PedidoSetorAtual" psa ON psa."pedidoId" = o."id"
      WHERE o."workspaceId" = ${workspaceId}
        AND (${status}::text IS NULL OR o."status" = ${status})
        AND (${prioridade}::text IS NULL OR o."prioridade" = ${prioridade})
        AND (${canal}::text IS NULL OR o."canal" = ${canal})
        AND (${setorId}::text IS NULL OR psa."setorId" = ${setorId})
    ` as any[]

    return NextResponse.json(serialize({
      pedidos,
      total: contagem.total,
      pagina,
      limite,
    }))
  } catch (error) {
    console.error('Erro GET pedidos:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const body = await req.json()
    const {
      numero, destinatario, idCliente, canal, produto,
      quantidade, valor, dataEntrada, dataEnvio,
      observacoes, prioridade, endereco, camposExtras,
    } = body

    if (!numero || !destinatario || !produto) {
      return NextResponse.json({ error: 'Número, destinatário e produto são obrigatórios' }, { status: 400 })
    }

    const workspaceId      = session.user.workspaceId
    const id               = gerarId()
    const dataEntradaDate  = toDate(dataEntrada)
    const dataEnvioDate    = toDate(dataEnvio)
    const qtd              = parseInt(String(quantidade)) || 1
    const valorNum         = valor ? parseFloat(String(valor)) : null
    const camposExtrasJson = camposExtras ? JSON.stringify(camposExtras) : null

    await prisma.$executeRaw`
      INSERT INTO "Order" (
        "id", "workspaceId", "numero", "destinatario", "idCliente",
        "canal", "produto", "quantidade", "valor",
        "dataEntrada", "dataEnvio", "observacoes", "prioridade", "status",
        "endereco", "camposExtras"
      ) VALUES (
        ${id}, ${workspaceId}, ${numero}, ${destinatario}, ${idCliente ?? null},
        ${canal ?? null}, ${produto}, ${qtd}, ${valorNum},
        ${dataEntradaDate}, ${dataEnvioDate}, ${observacoes ?? null},
        ${prioridade ?? 'NORMAL'}, 'ABERTO',
        ${endereco ?? null}, ${camposExtrasJson}
      )
    `

    try {
      const histId = gerarId()
      await prisma.$executeRaw`
        INSERT INTO "PedidoHistorico" ("id","pedidoId","workspaceId","tipo","descricao","usuarioNome")
        VALUES (${histId}, ${id}, ${workspaceId}, 'CRIACAO', 'Pedido criado', ${session.user.name})
      `
    } catch (e) { console.warn('Histórico:', e) }

    const novos = await prisma.$queryRaw`SELECT * FROM "Order" WHERE "id" = ${id}` as any[]

    return NextResponse.json(serialize({ pedido: novos[0] }))
  } catch (error) {
    console.error('Erro POST pedido:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
