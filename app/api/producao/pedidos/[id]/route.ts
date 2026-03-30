import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — busca pedido por ID
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    const pedidos = await prisma.$queryRaw`
      SELECT o.*
      FROM "Order" o
      WHERE o."id" = ${id} AND o."workspaceId" = ${workspaceId}
    ` as any[]

    if (!pedidos.length) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

    const workflow = await prisma.$queryRaw`
      SELECT ps.*, s."nome" as "setorNome", s."ordem" as "setorOrdem",
             u."nome" as "responsavelNome"
      FROM "PedidoSetor" ps
      JOIN "SetorConfig" s ON s."id" = ps."setorId"
      LEFT JOIN "User" u ON u."id" = ps."responsavelId"
      WHERE ps."pedidoId" = ${id}
        AND ps."workspaceId" = ${workspaceId}
      ORDER BY s."ordem" ASC
    ` as any[]

    return NextResponse.json({ pedido: pedidos[0], workflow })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PUT — atualiza pedido campo por campo
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    const workspaceId = session.user.workspaceId

    const pedidos = await prisma.$queryRaw`
      SELECT id FROM "Order" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!pedidos.length) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

    if (body.numero        !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "numero"       = ${body.numero},                         "updatedAt" = NOW() WHERE "id" = ${id}`
    if (body.destinatario  !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "destinatario" = ${body.destinatario},                   "updatedAt" = NOW() WHERE "id" = ${id}`
    if (body.idCliente     !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "idCliente"    = ${body.idCliente},                      "updatedAt" = NOW() WHERE "id" = ${id}`
    if (body.canal         !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "canal"        = ${body.canal},                          "updatedAt" = NOW() WHERE "id" = ${id}`
    if (body.produto       !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "produto"      = ${body.produto},                        "updatedAt" = NOW() WHERE "id" = ${id}`
    if (body.quantidade    !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "quantidade"   = ${Number(body.quantidade)},              "updatedAt" = NOW() WHERE "id" = ${id}`
    if (body.valor         !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "valor"        = ${body.valor ? Number(body.valor) : null},"updatedAt" = NOW() WHERE "id" = ${id}`
    if (body.observacoes   !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "observacoes"  = ${body.observacoes},                    "updatedAt" = NOW() WHERE "id" = ${id}`
    if (body.prioridade    !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "prioridade"   = ${body.prioridade},                     "updatedAt" = NOW() WHERE "id" = ${id}`
    if (body.status        !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "status"       = ${body.status},                         "updatedAt" = NOW() WHERE "id" = ${id}`
    if (body.endereco      !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "endereco"     = ${body.endereco},                       "updatedAt" = NOW() WHERE "id" = ${id}`
    if (body.responsavelId !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "responsavelId"= ${body.responsavelId},                  "updatedAt" = NOW() WHERE "id" = ${id}`

    // FIX B2: campo camposExtras estava ausente — campos personalizados não salvavam
    if (body.camposExtras  !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "camposExtras" = ${body.camposExtras},                   "updatedAt" = NOW() WHERE "id" = ${id}`

    // Datas: converte string para Date antes do INSERT para evitar type mismatch
    if (body.dataEntrada !== undefined) {
      const d = body.dataEntrada ? new Date(body.dataEntrada) : null
      await prisma.$executeRaw`UPDATE "Order" SET "dataEntrada" = ${d}, "updatedAt" = NOW() WHERE "id" = ${id}`
    }
    if (body.dataEnvio !== undefined) {
      const d = body.dataEnvio ? new Date(body.dataEnvio) : null
      await prisma.$executeRaw`UPDATE "Order" SET "dataEnvio" = ${d}, "updatedAt" = NOW() WHERE "id" = ${id}`
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE — cancela pedido
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    await prisma.$executeRaw`
      UPDATE "Order" SET "status" = 'CANCELADO', "updatedAt" = NOW()
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
