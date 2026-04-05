import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

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
// GET — pedidos do setor
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const setorId           = searchParams.get('setorId')
    const incluirConcluidos = searchParams.get('incluirConcluidos') === 'true'

    if (!setorId) return NextResponse.json({ error: 'setorId obrigatório' }, { status: 400 })

    const workspaceId = session.user.workspaceId

    const setorInfo = await prisma.$queryRaw`
      SELECT nome FROM "SetorConfig"
      WHERE id = ${setorId} AND "workspaceId" = ${workspaceId}
      LIMIT 1
    ` as any[]

    const nomeSetor = setorInfo[0]?.nome || 'Setor'

    const statusFiltro = incluirConcluidos
      ? ['EM_ANDAMENTO', 'DEVOLVIDO', 'CONCLUIDO']
      : ['EM_ANDAMENTO', 'DEVOLVIDO']

    const pedidos = await prisma.$queryRaw`
      SELECT
        ps."id",
        ps."pedidoId",
        ps."setorId",
        ps."status"          AS "statusSetor",
        ps."iniciadoEm",
        ps."concluidoEm",
        ps."observacoes",
        ps."estoqueInsuficiente",
        o."id"               AS "orderId",
        o."numero",
        o."destinatario",
        o."idCliente",
        o."produto",
        o."quantidade",
        o."prioridade",
        o."status",
        o."dataEnvio",
        o."dataEntrada",
        o."canal",
        o."camposExtras",
        o."endereco",
        o."observacoes"      AS "observacoesPedido",
        u."nome"             AS "responsavelNome"
      FROM "PedidoSetor" ps
      JOIN "Order" o  ON o."id" = ps."pedidoId"
      LEFT JOIN "User" u ON u."id" = ps."responsavelId"
      WHERE ps."setorId"     = ${setorId}
        AND ps."workspaceId" = ${workspaceId}
        AND o."status" NOT IN ('CANCELADO')
        AND ps."status" = ANY(${statusFiltro})
      ORDER BY
        CASE o."prioridade"
          WHEN 'URGENTE' THEN 1 WHEN 'ALTA' THEN 2
          WHEN 'NORMAL'  THEN 3 WHEN 'BAIXA' THEN 4 ELSE 5
        END,
        ps."iniciadoEm" ASC NULLS FIRST
    ` as any[]

    const totais = await prisma.$queryRaw`
      SELECT ps."status", COUNT(*)::int AS total
      FROM "PedidoSetor" ps
      JOIN "Order" o ON o."id" = ps."pedidoId"
      WHERE ps."setorId"     = ${setorId}
        AND ps."workspaceId" = ${workspaceId}
        AND o."status" NOT IN ('CANCELADO')
      GROUP BY ps."status"
    ` as any[]

    return NextResponse.json({
      nomeSetor,
      pedidos: serializar(pedidos),
      totais:  serializar(totais),
    })
  } catch (error) {
    console.error('GET /api/producao/workflow:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// POST — ações de workflow
//
// { pedidoId }                         → inicia workflow (ABERTO) OU avança setor
// { pedidoId, acao: 'iniciar_setor' }  → marca iniciadoEm = NOW no setor atual
// { pedidoId, devolver: true }         → devolve ao setor anterior
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const body = await req.json()
    const { pedidoId, devolver, acao } = body
    if (!pedidoId) return NextResponse.json({ error: 'pedidoId obrigatório' }, { status: 400 })

    const workspaceId = session.user.workspaceId
    const agora       = new Date()

    const pedidos = await prisma.$queryRaw`
      SELECT id, status FROM "Order"
      WHERE id = ${pedidoId} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!pedidos.length) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

    const pedido = pedidos[0]

    // ── AÇÃO: Iniciar no setor (iniciadoEm = NOW) ─────────────
    // Transição: EM_ANDAMENTO/DEVOLVIDO com iniciadoEm NULL → iniciadoEm NOW
    if (acao === 'iniciar_setor') {
      const setorAtual = await prisma.$queryRaw`
        SELECT ps.id, ps."setorId", sc.nome
        FROM "PedidoSetor" ps
        JOIN "SetorConfig" sc ON sc.id = ps."setorId"
        WHERE ps."pedidoId" = ${pedidoId}
          AND ps."workspaceId" = ${workspaceId}
          AND ps."status" IN ('EM_ANDAMENTO', 'DEVOLVIDO')
          AND ps."iniciadoEm" IS NULL
        LIMIT 1
      ` as any[]

      if (!setorAtual.length)
        return NextResponse.json({ error: 'Setor não encontrado ou já iniciado' }, { status: 400 })

      // Marca como EM_ANDAMENTO com iniciadoEm
      await prisma.$executeRaw`
        UPDATE "PedidoSetor"
        SET status = 'EM_ANDAMENTO', "iniciadoEm" = ${agora}
        WHERE "pedidoId" = ${pedidoId}
          AND "setorId"  = ${setorAtual[0].setorId}
          AND "workspaceId" = ${workspaceId}
      `

      // Garante que pedido está EM_PRODUCAO
      if (pedido.status === 'ABERTO') {
        await prisma.$executeRaw`
          UPDATE "Order" SET status = 'EM_PRODUCAO', "updatedAt" = NOW()
          WHERE id = ${pedidoId} AND "workspaceId" = ${workspaceId}
        `
      }

      try {
        const histId = gerarId()
        await prisma.$executeRaw`
          INSERT INTO "PedidoHistorico" ("id","pedidoId","workspaceId","tipo","descricao","usuarioNome")
          VALUES (${histId}, ${pedidoId}, ${workspaceId}, 'INICIADO',
            ${'Iniciado em ' + setorAtual[0].nome}, ${session.user.name})
        `
      } catch {}

      return NextResponse.json({ ok: true, acao: 'iniciado_no_setor', setor: setorAtual[0].nome })
    }

    // ── AÇÃO: Iniciar workflow (pedido ABERTO) ────────────────
    // Cria todos os PedidoSetor, setor 1 = EM_ANDAMENTO com iniciadoEm NULL
    if (pedido.status === 'ABERTO') {
      const setores = await prisma.$queryRaw`
        SELECT id, nome, ordem FROM "SetorConfig"
        WHERE "workspaceId" = ${workspaceId} AND ativo = true
        ORDER BY ordem ASC
      ` as any[]

      if (!setores.length) return NextResponse.json({
        error: 'Nenhum setor configurado. Acesse Configurações → Produção.'
      }, { status: 400 })

      for (let i = 0; i < setores.length; i++) {
        const setor = setores[i]
        const existe = await prisma.$queryRaw`
          SELECT id FROM "PedidoSetor"
          WHERE "pedidoId" = ${pedidoId} AND "setorId" = ${setor.id}
        ` as any[]
        if (existe.length) continue

        const id = gerarId()
        if (i === 0) {
          // Primeiro setor: EM_ANDAMENTO mas iniciadoEm = NULL (mostra "Iniciar")
          await prisma.$executeRaw`
            INSERT INTO "PedidoSetor" ("id","workspaceId","pedidoId","setorId","status")
            VALUES (${id}, ${workspaceId}, ${pedidoId}, ${setor.id}, 'EM_ANDAMENTO')
          `
        } else {
          await prisma.$executeRaw`
            INSERT INTO "PedidoSetor" ("id","workspaceId","pedidoId","setorId","status")
            VALUES (${id}, ${workspaceId}, ${pedidoId}, ${setor.id}, 'PENDENTE')
          `
        }
      }

      await prisma.$executeRaw`
        UPDATE "Order" SET status = 'EM_PRODUCAO', "updatedAt" = NOW()
        WHERE id = ${pedidoId} AND "workspaceId" = ${workspaceId}
      `

      try {
        const histId = gerarId()
        await prisma.$executeRaw`
          INSERT INTO "PedidoHistorico" ("id","pedidoId","workspaceId","tipo","descricao","usuarioNome")
          VALUES (${histId}, ${pedidoId}, ${workspaceId}, 'STATUS',
            ${'Produção iniciada → ' + (setores[0] as any).nome}, ${session.user.name})
        `
      } catch {}

      return NextResponse.json({ ok: true, acao: 'iniciado', primeiroSetor: (setores[0] as any).nome })
    }

    // ── Pedido já está EM_PRODUCAO ────────────────────────────
    const todosSetores = await prisma.$queryRaw`
      SELECT id, nome, ordem FROM "SetorConfig"
      WHERE "workspaceId" = ${workspaceId} AND ativo = true
      ORDER BY ordem ASC
    ` as any[]

    // Setor atual (EM_ANDAMENTO com iniciadoEm preenchido)
    const setorAtualRows = await prisma.$queryRaw`
      SELECT ps.id, ps."setorId", sc.nome, sc.ordem
      FROM "PedidoSetor" ps
      JOIN "SetorConfig" sc ON sc.id = ps."setorId"
      WHERE ps."pedidoId"    = ${pedidoId}
        AND ps."workspaceId" = ${workspaceId}
        AND ps."status"      = 'EM_ANDAMENTO'
        AND ps."iniciadoEm"  IS NOT NULL
      LIMIT 1
    ` as any[]

    if (!setorAtualRows.length)
      return NextResponse.json({ error: 'Pedido não está em andamento em nenhum setor. Clique em Iniciar primeiro.' }, { status: 400 })

    const setorAtual = setorAtualRows[0]
    const ordemAtual = Number(setorAtual.ordem)

    // ── AÇÃO: Devolver ao setor anterior ─────────────────────
    if (devolver) {
      const setorAnterior = todosSetores
        .filter((s: any) => Number(s.ordem) < ordemAtual)
        .sort((a: any, b: any) => Number(b.ordem) - Number(a.ordem))[0]

      if (!setorAnterior)
        return NextResponse.json({ error: 'Não há setor anterior para devolver' }, { status: 400 })

      // Atual → PENDENTE (some da tela do setor atual, evita duplicação)
      await prisma.$executeRaw`
        UPDATE "PedidoSetor"
        SET status = 'PENDENTE', "concluidoEm" = NULL, "iniciadoEm" = NULL
        WHERE "pedidoId" = ${pedidoId} AND "setorId" = ${setorAtual.setorId}
      `

      // Anterior → EM_ANDAMENTO com iniciadoEm = NULL (mostra "Iniciar" novamente)
      // Status DEVOLVIDO sinaliza que o pedido foi retornado para este setor
      await prisma.$executeRaw`
        UPDATE "PedidoSetor"
        SET status = 'DEVOLVIDO', "iniciadoEm" = NULL, "concluidoEm" = NULL
        WHERE "pedidoId" = ${pedidoId} AND "setorId" = ${setorAnterior.id}
      `

      try {
        const histId = gerarId()
        await prisma.$executeRaw`
          INSERT INTO "PedidoHistorico" ("id","pedidoId","workspaceId","tipo","descricao","usuarioNome")
          VALUES (${histId}, ${pedidoId}, ${workspaceId}, 'DEVOLVIDO',
            ${setorAtual.nome + ' → devolvido para → ' + setorAnterior.nome}, ${session.user.name})
        `
      } catch {}

      return NextResponse.json({ ok: true, acao: 'devolvido', setorAnterior: setorAnterior.nome })
    }

    // ── AÇÃO: Avançar para próximo setor (Concluir) ───────────
    const proximoSetor = todosSetores
      .filter((s: any) => Number(s.ordem) > ordemAtual)
      .sort((a: any, b: any) => Number(a.ordem) - Number(b.ordem))[0]

    // Conclui setor atual
    await prisma.$executeRaw`
      UPDATE "PedidoSetor"
      SET status = 'CONCLUIDO', "concluidoEm" = ${agora}
      WHERE "pedidoId" = ${pedidoId} AND "setorId" = ${setorAtual.setorId}
    `

    if (!proximoSetor) {
      // Último setor — conclui o pedido
      await prisma.$executeRaw`
        UPDATE "Order" SET status = 'CONCLUIDO', "updatedAt" = NOW()
        WHERE id = ${pedidoId} AND "workspaceId" = ${workspaceId}
      `
      try {
        const histId = gerarId()
        await prisma.$executeRaw`
          INSERT INTO "PedidoHistorico" ("id","pedidoId","workspaceId","tipo","descricao","usuarioNome")
          VALUES (${histId}, ${pedidoId}, ${workspaceId}, 'CONCLUIDO',
            ${'Pedido concluído após ' + setorAtual.nome}, ${session.user.name})
        `
      } catch {}
      return NextResponse.json({ ok: true, acao: 'concluido', mensagem: 'Pedido concluído!' })
    }

    // Ativa próximo setor com iniciadoEm = NULL (mostra "Iniciar")
    await prisma.$executeRaw`
      UPDATE "PedidoSetor"
      SET status = 'EM_ANDAMENTO', "iniciadoEm" = NULL, "concluidoEm" = NULL
      WHERE "pedidoId" = ${pedidoId} AND "setorId" = ${proximoSetor.id}
    `

    try {
      const histId = gerarId()
      await prisma.$executeRaw`
        INSERT INTO "PedidoHistorico" ("id","pedidoId","workspaceId","tipo","descricao","usuarioNome")
        VALUES (${histId}, ${pedidoId}, ${workspaceId}, 'AVANCO',
          ${setorAtual.nome + ' → ' + proximoSetor.nome}, ${session.user.name})
      `
    } catch {}

    return NextResponse.json({ ok: true, acao: 'avancou', proximoSetor: proximoSetor.nome })

  } catch (error) {
    console.error('POST /api/producao/workflow:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// PUT — atualizar responsável no PedidoSetor
// Body: { pedidoId, setorId, responsavelId }
// ─────────────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { pedidoId, setorId, responsavelId } = await req.json()
    if (!pedidoId || !setorId || !responsavelId)
      return NextResponse.json({ error: 'pedidoId, setorId e responsavelId obrigatórios' }, { status: 400 })

    const workspaceId = session.user.workspaceId

    await prisma.$executeRaw`
      UPDATE "PedidoSetor"
      SET "responsavelId" = ${responsavelId}
      WHERE "pedidoId"     = ${pedidoId}
        AND "setorId"      = ${setorId}
        AND "workspaceId"  = ${workspaceId}
    `

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/producao/workflow:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
