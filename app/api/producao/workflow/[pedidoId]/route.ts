import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// PUT — atualiza status, responsável, observações e flags do pedido em um setor
export async function PUT(req: NextRequest, { params }: { params: Promise<{ pedidoId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { pedidoId } = await params
    const body = await req.json()
    const { setorId, status, responsavelId, observacoes, estoqueInsuficiente } = body
    const workspaceId = session.user.workspaceId

    if (!setorId) return NextResponse.json({ error: 'setorId obrigatório' }, { status: 400 })

    const agora = new Date()

    // Atualiza campos individualmente
    if (status !== undefined) {
      if (status === 'EM_ANDAMENTO') {
        await prisma.$executeRaw`
          UPDATE "PedidoSetor"
          SET "status" = ${status}, "iniciadoEm" = ${agora}, "updatedAt" = NOW()
          WHERE "pedidoId" = ${pedidoId} AND "setorId" = ${setorId} AND "workspaceId" = ${workspaceId}
        `
      } else if (status === 'CONCLUIDO') {
        await prisma.$executeRaw`
          UPDATE "PedidoSetor"
          SET "status" = ${status}, "concluidoEm" = ${agora}, "updatedAt" = NOW()
          WHERE "pedidoId" = ${pedidoId} AND "setorId" = ${setorId} AND "workspaceId" = ${workspaceId}
        `

        // Verifica se todos os setores foram concluídos
        const [resultado] = await prisma.$queryRaw`
          SELECT COUNT(*) as total,
                 SUM(CASE WHEN "status" = 'CONCLUIDO' THEN 1 ELSE 0 END) as concluidos
          FROM "PedidoSetor"
          WHERE "pedidoId" = ${pedidoId} AND "workspaceId" = ${workspaceId}
        ` as any[]

        if (Number(resultado.total) > 0 && Number(resultado.total) === Number(resultado.concluidos)) {
          await prisma.$executeRaw`
            UPDATE "Order" SET "status" = 'CONCLUIDO', "updatedAt" = NOW()
            WHERE "id" = ${pedidoId} AND "workspaceId" = ${workspaceId}
          `
        }

        // Avança próximo setor para EM_ANDAMENTO
        const proximoSetor = await prisma.$queryRaw`
          SELECT ps."id", ps."setorId", s."nome"
          FROM "PedidoSetor" ps
          JOIN "SetorConfig" s ON s."id" = ps."setorId"
          WHERE ps."pedidoId" = ${pedidoId}
            AND ps."workspaceId" = ${workspaceId}
            AND ps."status" = 'PENDENTE'
          ORDER BY s."ordem" ASC
          LIMIT 1
        ` as any[]

        if (proximoSetor.length > 0) {
          await prisma.$executeRaw`
            UPDATE "PedidoSetor"
            SET "status" = 'EM_ANDAMENTO', "iniciadoEm" = ${agora}, "updatedAt" = NOW()
            WHERE "id" = ${(proximoSetor[0] as any).id}
          `
        }
      } else {
        await prisma.$executeRaw`
          UPDATE "PedidoSetor"
          SET "status" = ${status}, "updatedAt" = NOW()
          WHERE "pedidoId" = ${pedidoId} AND "setorId" = ${setorId} AND "workspaceId" = ${workspaceId}
        `
      }
    }

    if (responsavelId !== undefined) {
      await prisma.$executeRaw`
        UPDATE "PedidoSetor"
        SET "responsavelId" = ${responsavelId}, "updatedAt" = NOW()
        WHERE "pedidoId" = ${pedidoId} AND "setorId" = ${setorId} AND "workspaceId" = ${workspaceId}
      `
    }

    if (observacoes !== undefined) {
      await prisma.$executeRaw`
        UPDATE "PedidoSetor"
        SET "observacoes" = ${observacoes}, "updatedAt" = NOW()
        WHERE "pedidoId" = ${pedidoId} AND "setorId" = ${setorId} AND "workspaceId" = ${workspaceId}
      `
    }

    if (estoqueInsuficiente !== undefined) {
      await prisma.$executeRaw`
        UPDATE "PedidoSetor"
        SET "estoqueInsuficiente" = ${estoqueInsuficiente}, "updatedAt" = NOW()
        WHERE "pedidoId" = ${pedidoId} AND "setorId" = ${setorId} AND "workspaceId" = ${workspaceId}
      `
    }

    // Histórico
    try {
      if (status) {
        const histId = gerarId()
        const setores = await prisma.$queryRaw`SELECT "nome" FROM "SetorConfig" WHERE "id" = ${setorId}` as any[]
        const setorNome = setores[0]?.nome || setorId
        await prisma.$executeRaw`
          INSERT INTO "PedidoHistorico" ("id", "pedidoId", "workspaceId", "tipo", "descricao", "usuarioNome")
          VALUES (${histId}, ${pedidoId}, ${workspaceId}, 'SETOR', ${`${setorNome} → ${status}`}, ${session.user.name})
        `
      }
    } catch (e) { console.warn('Histórico:', e) }

    // Busca próximo setor
    const proximoSetor = await prisma.$queryRaw`
      SELECT s."id", s."nome"
      FROM "PedidoSetor" ps
      JOIN "SetorConfig" s ON s."id" = ps."setorId"
      WHERE ps."pedidoId" = ${pedidoId}
        AND ps."workspaceId" = ${workspaceId}
        AND ps."status" = 'EM_ANDAMENTO'
      ORDER BY s."ordem" ASC
      LIMIT 1
    ` as any[]

    return NextResponse.json({
      ok: true,
      proximoSetor: proximoSetor[0] || null,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// GET — workflow completo do pedido
export async function GET(req: NextRequest, { params }: { params: Promise<{ pedidoId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { pedidoId } = await params
    const workspaceId = session.user.workspaceId

    const workflow = await prisma.$queryRaw`
      SELECT ps.*, s."nome" as "setorNome", s."ordem" as "setorOrdem",
             u."nome" as "responsavelNome"
      FROM "PedidoSetor" ps
      JOIN "SetorConfig" s ON s."id" = ps."setorId"
      LEFT JOIN "User" u ON u."id" = ps."responsavelId"
      WHERE ps."pedidoId" = ${pedidoId} AND ps."workspaceId" = ${workspaceId}
      ORDER BY s."ordem" ASC
    ` as any[]

    return NextResponse.json({ workflow })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
