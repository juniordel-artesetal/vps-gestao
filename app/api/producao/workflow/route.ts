import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// Serializa BigInt e Date
function serializar(arr: any[]) {
  return arr.map(item => {
    const obj: any = {}
    for (const key of Object.keys(item)) {
      const val = item[key]
      obj[key] = typeof val === 'bigint' ? Number(val)
               : val instanceof Date     ? val.toISOString()
               : val
    }
    return obj
  })
}

// ─────────────────────────────────────────────────────────────
// GET — busca pedidos ATIVOS de um setor (EM_ANDAMENTO ou DEVOLVIDO)
//
// FIX B3: removido o filtro ?status= da URL. A query agora retorna
// APENAS os pedidos que estão EM_ANDAMENTO ou DEVOLVIDO neste setor,
// garantindo que cada pedido aparece somente no setor em que está alocado.
//
// Os totais ainda contam TODOS os status (PENDENTE, EM_ANDAMENTO,
// CONCLUIDO, DEVOLVIDO) para exibir as métricas corretas nos cards.
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const setorId = searchParams.get('setorId')

    if (!setorId) return NextResponse.json({ error: 'setorId obrigatório' }, { status: 400 })

    const workspaceId = session.user.workspaceId

    // ── Lista de pedidos ativos no setor ──────────────────────
    // Só mostra EM_ANDAMENTO e DEVOLVIDO — pedidos PENDENTE ainda
    // não chegaram neste setor; CONCLUIDO já saíram.
    const pedidos = await prisma.$queryRaw`
      SELECT
        ps."id", ps."pedidoId", ps."setorId", ps."status",
        ps."responsavelId", ps."observacoes", ps."iniciadoEm", ps."concluidoEm",
        ps."estoqueInsuficiente",
        o."numero", o."destinatario", o."produto", o."quantidade",
        o."prioridade", o."dataEnvio", o."dataEntrada",
        o."observacoes" as "observacoes_pedido",
        o."canal", o."idCliente", o."camposExtras", o."endereco",
        u."nome" as "responsavelNome"
      FROM "PedidoSetor" ps
      JOIN "Order" o ON o."id" = ps."pedidoId"
      LEFT JOIN "User" u ON u."id" = ps."responsavelId"
      WHERE ps."setorId"    = ${setorId}
        AND ps."workspaceId" = ${workspaceId}
        AND o."status" NOT IN ('CANCELADO')
        AND ps."status" IN ('EM_ANDAMENTO', 'DEVOLVIDO')
      ORDER BY
        CASE o."prioridade"
          WHEN 'URGENTE' THEN 1
          WHEN 'ALTA'    THEN 2
          WHEN 'NORMAL'  THEN 3
          WHEN 'BAIXA'   THEN 4
          ELSE 5
        END,
        ps."iniciadoEm" ASC
    ` as any[]

    // ── Totais por status (todos, inclusive PENDENTE/CONCLUIDO) ─
    const totais = await prisma.$queryRaw`
      SELECT ps."status", COUNT(*) as total
      FROM "PedidoSetor" ps
      JOIN "Order" o ON o."id" = ps."pedidoId"
      WHERE ps."setorId"    = ${setorId}
        AND ps."workspaceId" = ${workspaceId}
        AND o."status" NOT IN ('CANCELADO')
      GROUP BY ps."status"
    ` as any[]

    return NextResponse.json({
      pedidos: serializar(pedidos),
      totais:  serializar(totais),
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// POST — inicializa workflow: cria PedidoSetor para todos os
// setores, 1º setor = EM_ANDAMENTO, demais = PENDENTE
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { pedidoId } = await req.json()
    if (!pedidoId) return NextResponse.json({ error: 'pedidoId obrigatório' }, { status: 400 })

    const workspaceId = session.user.workspaceId

    // Verifica se pedido existe e pertence ao workspace
    const pedidos = await prisma.$queryRaw`
      SELECT id, status FROM "Order"
      WHERE "id" = ${pedidoId} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!pedidos.length) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    if (pedidos[0].status !== 'ABERTO') return NextResponse.json({ error: 'Pedido já está em produção' }, { status: 400 })

    // Busca todos os setores ativos em ordem
    const setores = await prisma.$queryRaw`
      SELECT "id", "nome", "ordem"
      FROM "SetorConfig"
      WHERE "workspaceId" = ${workspaceId}
        AND "ativo" = true
      ORDER BY "ordem" ASC
    ` as any[]

    if (!setores.length) {
      return NextResponse.json({
        error: 'Nenhum setor configurado. Acesse Configurações → Produção para criar os setores.'
      }, { status: 400 })
    }

    const agora = new Date()

    // Cria PedidoSetor para cada setor
    for (let i = 0; i < setores.length; i++) {
      const setor = setores[i]
      const ePrimeiroSetor = i === 0

      // Verifica se já existe
      const existente = await prisma.$queryRaw`
        SELECT id FROM "PedidoSetor"
        WHERE "pedidoId" = ${pedidoId} AND "setorId" = ${setor.id}
      ` as any[]

      if (existente.length) continue

      const id = gerarId()

      if (ePrimeiroSetor) {
        await prisma.$executeRaw`
          INSERT INTO "PedidoSetor" (
            "id", "workspaceId", "pedidoId", "setorId", "status", "iniciadoEm"
          ) VALUES (
            ${id}, ${workspaceId}, ${pedidoId}, ${setor.id}, 'EM_ANDAMENTO', ${agora}
          )
        `
      } else {
        await prisma.$executeRaw`
          INSERT INTO "PedidoSetor" (
            "id", "workspaceId", "pedidoId", "setorId", "status"
          ) VALUES (
            ${id}, ${workspaceId}, ${pedidoId}, ${setor.id}, 'PENDENTE'
          )
        `
      }
    }

    // Atualiza pedido para EM_PRODUCAO
    await prisma.$executeRaw`
      UPDATE "Order"
      SET "status" = 'EM_PRODUCAO', "updatedAt" = NOW()
      WHERE "id" = ${pedidoId} AND "workspaceId" = ${workspaceId}
    `

    // Histórico
    try {
      const histId = gerarId()
      const primeiroNome = (setores[0] as any).nome
      await prisma.$executeRaw`
        INSERT INTO "PedidoHistorico" ("id","pedidoId","workspaceId","tipo","descricao","usuarioNome")
        VALUES (
          ${histId}, ${pedidoId}, ${workspaceId},
          'STATUS',
          ${'Produção iniciada → ' + primeiroNome},
          ${session.user.name}
        )
      `
    } catch (e) { console.warn('Histórico:', e) }

    return NextResponse.json({
      ok: true,
      setores: setores.length,
      primeiroSetor: { id: (setores[0] as any).id, nome: (setores[0] as any).nome },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
