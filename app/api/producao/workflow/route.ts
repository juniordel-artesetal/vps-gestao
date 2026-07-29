import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { baixarEstoqueMaterial, reverterBaixaEstoque } from '@/lib/baixarEstoqueMaterial'
import { ensureMarketplaceTables } from '@/lib/marketplaceSchema'
import { orderByPedido } from '@/lib/ordenacaoPedidos'
import { ehSetorExpedicao } from '@/lib/statusPedido'
import { flagsCanais, resolverTaxa, calcularLiquido, valorTaxa, dataRecebimento } from '@/lib/canaisVenda'

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

    // Filtro de data de envio via query param (YYYY-MM-DD ou __VAZIO__)
    const dataEnvioFiltro = searchParams.get('dataEnvio') || null

    // Ordenação escolhida (botão "Ordenar") — server-side, mesmas opções da
    // lista geral. Sem escolha → mantém o default do setor (prioridade +
    // iniciadoEm ASC NULLS FIRST, que é a ordem natural da fila).
    const ordenacao   = searchParams.get('ordenacao') || ''
    const orderClause = orderByPedido(ordenacao) ?? Prisma.sql`
      ORDER BY
        CASE o."prioridade"
          WHEN 'URGENTE' THEN 1 WHEN 'ALTA' THEN 2
          WHEN 'NORMAL'  THEN 3 WHEN 'BAIXA' THEN 4 ELSE 5
        END,
        ps."iniciadoEm" ASC NULLS FIRST
    `

    // Cláusula de data: suporta valor específico ou __VAZIO__ (sem data)
    const dateClause = dataEnvioFiltro === '__VAZIO__'
      ? Prisma.sql`AND o."dataEnvio" IS NULL`
      : (dataEnvioFiltro && dataEnvioFiltro.length === 10)
        ? Prisma.sql`AND TO_CHAR(o."dataEnvio", 'YYYY-MM-DD') = ${dataEnvioFiltro}`
        : Prisma.empty
    // Status como IN parametrizado (substitui ANY($3) que pode falhar com arrays JS)
    const statusIn = Prisma.join(statusFiltro.map((s: string) => Prisma.sql`${s}`))

    // OPERADORA: filtra por (setor permitido em UserSetor) E (responsável)
    // Se OPERADORA não tem nenhum vínculo em UserSetor → vê todos os pedidos onde é responsável (qualquer setor)
    let operadorClause: any = Prisma.empty
    if (session.user.role === 'OPERADOR') {
      const vinculos = await prisma.$queryRaw`
        SELECT "setorId" FROM "UserSetor"
        WHERE "userId" = ${session.user.id} AND "workspaceId" = ${workspaceId}
      ` as any[]

      const responsavelClause = Prisma.sql`(
        ps."responsavelId" = ${session.user.id}
        OR o."camposExtras"::jsonb->>'responsavelId' = ${session.user.id}
      )`

      if (vinculos.length > 0) {
        // Tem vínculos → setor da rota PRECISA estar na lista permitida.
        // Se o setor da rota não estiver, retorna lista vazia.
        const setorIdsPermitidos = vinculos.map((v: any) => v.setorId)
        if (!setorIdsPermitidos.includes(setorId)) {
          // Setor não permitido → não retorna nenhum pedido
          return NextResponse.json({
            nomeSetor,
            pedidos: [],
            totais: [],
          })
        }
        operadorClause = Prisma.sql`AND ${responsavelClause}`
      } else {
        // Sem vínculo → comportamento antigo: vê tudo onde é responsável
        operadorClause = Prisma.sql`AND ${responsavelClause}`
      }
    }

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
        TO_CHAR(o."dataEnvio",   'YYYY-MM-DD') AS "dataEnvio",
        TO_CHAR(o."dataEntrada", 'YYYY-MM-DD') AS "dataEntrada",
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
        AND ps."status" IN (${statusIn})
        ${dateClause}
        ${operadorClause}
      ${orderClause}
    ` as any[]

    const totais = await prisma.$queryRaw`
      SELECT ps."status", COUNT(*)::int AS total
      FROM "PedidoSetor" ps
      JOIN "Order" o ON o."id" = ps."pedidoId"
      WHERE ps."setorId"     = ${setorId}
        AND ps."workspaceId" = ${workspaceId}
        AND o."status" NOT IN ('CANCELADO')
        ${operadorClause}
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

    const body = await req.json()
    const { pedidoId, devolver, acao, setorDestinoId, motivo } = body
    if (!pedidoId) return NextResponse.json({ error: 'pedidoId obrigatório' }, { status: 400 })

    // OPERADORA: pode iniciar/concluir/devolver, mas NÃO pode mover pedido para um setor arbitrário
    // (mover pra setor específico é setorDestinoId vindo do botão "mover" — privilegiado)
    if (session.user.role === 'OPERADOR' && setorDestinoId && !devolver) {
      return NextResponse.json({ error: 'Sem permissão para mover pedido entre setores' }, { status: 403 })
    }

    const workspaceId = session.user.workspaceId
    const agora       = new Date()

    const pedidos = await prisma.$queryRaw`
      SELECT id, status, canal, numero, valor, produto, quantidade, "camposExtras", "metodoPagamento"
      FROM "Order"
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
    // Exceção: se veio setorDestinoId (mover/saltar para um setor específico), NÃO iniciamos
    // no primeiro setor — caímos no fluxo de "mover para setor" abaixo, que salta corretamente
    // (anteriores = Concluídos, destino = atual, posteriores = Pendentes). Sem isso, pedidos
    // SEM setor iam parar sempre no 1º setor (bug da Folha Mágica).
    if (pedido.status === 'ABERTO' && !setorDestinoId) {
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

      // Ponteiro do setor atual → primeiro setor (pra "Setor atual" já aparecer na lista)
      try {
        await prisma.$executeRaw`
          DELETE FROM "PedidoSetorAtual" WHERE "pedidoId" = ${pedidoId} AND "workspaceId" = ${workspaceId}
        `
        await prisma.$executeRaw`
          INSERT INTO "PedidoSetorAtual" ("pedidoId","workspaceId","setorId","updatedAt")
          VALUES (${pedidoId}, ${workspaceId}, ${(setores[0] as any).id}, NOW())
        `
      } catch {}

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

    // ── Pedido já está EM_PRODUCAO (ou vindo de "mover para setor") ──────
    const todosSetores = await prisma.$queryRaw`
        SELECT id, nome, ordem, "ehExpedicao" FROM "SetorConfig"
        WHERE "workspaceId" = ${workspaceId} AND ativo = true
        ORDER BY ordem ASC
      ` as any[]

    // Workspace tem algum setor de expedição marcado? (define a regra Prontos/Enviado)
    const temExpedicaoMarcada = todosSetores.some((s: any) => s.ehExpedicao === true)

    // Setor atual (EM_ANDAMENTO com iniciadoEm preenchido, ou sem iniciadoEm para mover)
    const setorAtualRows = await prisma.$queryRaw`
      SELECT ps.id, ps."setorId", sc.nome, sc.ordem, sc."ehExpedicao"
      FROM "PedidoSetor" ps
      JOIN "SetorConfig" sc ON sc.id = ps."setorId"
      WHERE ps."pedidoId"    = ${pedidoId}
        AND ps."workspaceId" = ${workspaceId}
        AND ps."status"      = 'EM_ANDAMENTO'
      ORDER BY ps."iniciadoEm" DESC NULLS LAST
      LIMIT 1
    ` as any[]

    // Avançar/concluir e devolver-ao-anterior EXIGEM um setor atual. Mover para um setor
    // específico (setorDestinoId) NÃO exige — funciona até para pedido sem setor nenhum.
    const setorAtual = setorAtualRows[0] || null
    if (!setorAtual && !setorDestinoId)
      return NextResponse.json({ error: 'Pedido não está em andamento em nenhum setor. Clique em Iniciar primeiro.' }, { status: 400 })

    const ordemAtual = setorAtual ? Number(setorAtual.ordem) : -1

    // ── AÇÃO: Devolver ao setor anterior ─────────────────────
    if (devolver) {
      // ── MOVER PARA SETOR (ou devolver ao anterior) ──────────────────
      // Estratégia: deixa o fluxo TOTALMENTE consistente com o destino:
      //   - Todos setores ANTES do destino → CONCLUIDO
      //   - Setor destino → EM_ANDAMENTO (ou DEVOLVIDO se foi devolução real)
      //   - Todos setores DEPOIS do destino → PENDENTE
      //   - PedidoSetorAtual → aponta para o destino
      //   - Order.status → EM_PRODUCAO
      // idx do setor atual: -1 quando o pedido ainda não está em setor nenhum (ABERTO/sem setor)
      const idxAtualDev = setorAtual ? todosSetores.findIndex((s: any) => s.id === setorAtual.setorId) : -1
      let setorDestino = setorDestinoId
        ? todosSetores.find((s: any) => s.id === setorDestinoId)
        : idxAtualDev > 0 ? todosSetores[idxAtualDev - 1] : undefined

      if (!setorDestino && !setorDestinoId && setorAtual) {
        setorDestino = todosSetores.find((s: any) => s.id === setorAtual.setorId)
      }

      if (!setorDestino)
        return NextResponse.json({ error: 'Setor de destino não encontrado' }, { status: 400 })

      const idxDestino = todosSetores.findIndex((s: any) => s.id === setorDestino.id)
      const ehMovimentoVoltaAtras = idxDestino < idxAtualDev
      const tipoDestino = ehMovimentoVoltaAtras ? 'DEVOLVIDO' : 'EM_ANDAMENTO'

      // 1) Setores ANTES do destino → CONCLUIDO (preservando datas se já existirem)
      for (let i = 0; i < idxDestino; i++) {
        const s = todosSetores[i] as any
        const existe = await prisma.$queryRaw`
          SELECT id, "iniciadoEm", "concluidoEm" FROM "PedidoSetor"
          WHERE "pedidoId" = ${pedidoId} AND "setorId" = ${s.id}
        ` as any[]
        if (existe.length > 0) {
          await prisma.$executeRaw`
            UPDATE "PedidoSetor"
            SET status = 'CONCLUIDO',
                "iniciadoEm"  = COALESCE("iniciadoEm", NOW()),
                "concluidoEm" = COALESCE("concluidoEm", NOW()),
                "updatedAt"   = NOW()
            WHERE id = ${existe[0].id}
          `
        } else {
          await prisma.$executeRaw`
            INSERT INTO "PedidoSetor" ("id","workspaceId","pedidoId","setorId","status","iniciadoEm","concluidoEm")
            VALUES (${gerarId()}, ${workspaceId}, ${pedidoId}, ${s.id}, 'CONCLUIDO', NOW(), NOW())
          `
        }
      }

      // 2) Setor DESTINO → DEVOLVIDO (se volta atrás) ou EM_ANDAMENTO (se vai pra frente)
      const existeDestino = await prisma.$queryRaw`
        SELECT id FROM "PedidoSetor"
        WHERE "pedidoId" = ${pedidoId} AND "setorId" = ${setorDestino.id}
      ` as any[]
      if (existeDestino.length > 0) {
        await prisma.$executeRaw`
          UPDATE "PedidoSetor"
          SET status = ${tipoDestino},
              "iniciadoEm"  = NULL,
              "concluidoEm" = NULL,
              "observacoes" = ${motivo || null},
              "updatedAt"   = NOW()
          WHERE id = ${existeDestino[0].id}
        `
      } else {
        await prisma.$executeRaw`
          INSERT INTO "PedidoSetor" ("id","workspaceId","pedidoId","setorId","status","observacoes")
          VALUES (${gerarId()}, ${workspaceId}, ${pedidoId}, ${setorDestino.id}, ${tipoDestino}, ${motivo || null})
        `
      }

      // 3) Setores DEPOIS do destino → PENDENTE (zera datas)
      for (let i = idxDestino + 1; i < todosSetores.length; i++) {
        const s = todosSetores[i] as any
        const existe = await prisma.$queryRaw`
          SELECT id FROM "PedidoSetor"
          WHERE "pedidoId" = ${pedidoId} AND "setorId" = ${s.id}
        ` as any[]
        if (existe.length > 0) {
          await prisma.$executeRaw`
            UPDATE "PedidoSetor"
            SET status = 'PENDENTE',
                "iniciadoEm"  = NULL,
                "concluidoEm" = NULL,
                "updatedAt"   = NOW()
            WHERE id = ${existe[0].id}
          `
        } else {
          // Não existia (ex.: pedido movido SEM ter passado por aqui) → cria como PENDENTE,
          // honrando o "posteriores como Pendentes" prometido no diálogo.
          await prisma.$executeRaw`
            INSERT INTO "PedidoSetor" ("id","workspaceId","pedidoId","setorId","status")
            VALUES (${gerarId()}, ${workspaceId}, ${pedidoId}, ${s.id}, 'PENDENTE')
          `
        }
      }

      // 4) PedidoSetorAtual → aponta para o destino
      try {
        await prisma.$executeRaw`
          DELETE FROM "PedidoSetorAtual"
          WHERE "pedidoId" = ${pedidoId} AND "workspaceId" = ${workspaceId}
        `
        await prisma.$executeRaw`
          INSERT INTO "PedidoSetorAtual" ("pedidoId","workspaceId","setorId","updatedAt")
          VALUES (${pedidoId}, ${workspaceId}, ${setorDestino.id}, NOW())
        `
      } catch {}

      // 5) Order.status conforme o destino: se caiu no setor de EXPEDIÇÃO, o pedido está
      //    PRONTO (produção concluída, aguardando expedir). Senão volta ao fluxo normal de
      //    produção → EM_PRODUCAO. (Sai de ENVIADO/ABERTO corretamente.)
      const destinoEhExpedicao = ehSetorExpedicao(setorDestino, temExpedicaoMarcada)
      await prisma.$executeRaw`
        UPDATE "Order" SET status = ${destinoEhExpedicao ? 'PRONTO' : 'EM_PRODUCAO'}, "updatedAt" = NOW()
        WHERE id = ${pedidoId} AND "workspaceId" = ${workspaceId}
      `

      try {
        const histId = gerarId()
        const verbo = ehMovimentoVoltaAtras ? 'devolvido para' : 'movido para'
        const origemNome = setorAtual?.nome || 'Sem setor'
        await prisma.$executeRaw`
          INSERT INTO "PedidoHistorico" ("id","pedidoId","workspaceId","tipo","descricao","usuarioNome")
          VALUES (${histId}, ${pedidoId}, ${workspaceId}, ${ehMovimentoVoltaAtras ? 'DEVOLVIDO' : 'AVANCO'},
            ${origemNome + ' → ' + verbo + ' → ' + setorDestino.nome + (motivo ? ' | Motivo: ' + motivo : '')},
            ${session.user.name})
        `
      } catch {}

      return NextResponse.json({
        ok: true,
        acao: ehMovimentoVoltaAtras ? 'devolvido' : 'movido',
        setorDestino: setorDestino.nome,
      })
    }

    // ── AÇÃO: Avançar para próximo setor (Concluir) ───────────
    // Chegou aqui sem devolver/mover → precisa de um setor atual.
    if (!setorAtual)
      return NextResponse.json({ error: 'Pedido não está em andamento em nenhum setor. Clique em Iniciar primeiro.' }, { status: 400 })

    // Usa posição no array — não compara .ordem para ser compatível com
    // FluxoModeloSetor.ordem (0,1,2...) e SetorConfig.ordem (global)
    const idxAtual     = todosSetores.findIndex((s: any) => s.id === setorAtual.setorId)
    const proximoSetor = idxAtual >= 0 ? todosSetores[idxAtual + 1] : undefined

    // Conclui setor atual
    await prisma.$executeRaw`
      UPDATE "PedidoSetor"
      SET status = 'CONCLUIDO', "concluidoEm" = ${agora}
      WHERE "pedidoId" = ${pedidoId} AND "setorId" = ${setorAtual.setorId}
    `

    if (!proximoSetor) {
      // Último setor → ENVIADO se este setor for o de EXPEDIÇÃO; senão → PRONTO
      // (produção terminada sem etapa de expedição = estado final da artesã).
      const isExpedicao = ehSetorExpedicao(setorAtual, temExpedicaoMarcada)
      const novoStatus  = isExpedicao ? 'ENVIADO' : 'PRONTO'
      await prisma.$executeRaw`
        UPDATE "Order" SET status = ${novoStatus}, "updatedAt" = NOW()
        WHERE id = ${pedidoId} AND "workspaceId" = ${workspaceId}
      `

      // ── Recebível do marketplace: ENVIADO → previsto (data real de envio + N dias) ──
      // Só afeta pedidos que têm recebível (criado na importação com o módulo ligado).
      // NUNCA cria FinLancamento — é previsão pura.
      if (novoStatus === 'ENVIADO') {
        try {
          await ensureMarketplaceTables()
          const cfg = await prisma.$queryRaw`
            SELECT "diasRepasse"::int AS "diasRepasse" FROM "MarketplaceConfig"
            WHERE "workspaceId" = ${workspaceId} AND "canal" = 'shopee' LIMIT 1
          ` as any[]
          const dias = cfg[0]?.diasRepasse ?? 7
          await prisma.$executeRaw`
            UPDATE "Recebivel"
            SET "status" = 'previsto', "dataPrevista" = (CURRENT_DATE + ${dias}::int), "updatedAt" = NOW()
            WHERE "workspaceId" = ${workspaceId} AND "orderId" = ${pedidoId} AND "status" = 'aguardando_envio'
          `
        } catch (e) { console.error('[workflow] recebivel previsto:', e) }
      }

      try {
        const histId = gerarId()
        await prisma.$executeRaw`
          INSERT INTO "PedidoHistorico" ("id","pedidoId","workspaceId","tipo","descricao","usuarioNome")
          VALUES (${histId}, ${pedidoId}, ${workspaceId}, 'CONCLUIDO',
            ${'Pedido concluído após ' + setorAtual.nome}, ${session.user.name})
        `
      } catch {}

      // ── Fim do fluxo: lançamento financeiro da RECEITA ──────────────────
      // PADRÃO (flags OFF): canais manuais têm um pendente [saldo-auto] (criado na
      // criação do pedido) → aqui vira PAGO pelo valor CHEIO (bruto). Pedidos antigos
      // sem pendente → fallback cria PAGO direto. Comportamento atual preservado.
      //
      // Com moduloCanais + canaisLancaFinanceiro ON: a receita entra LÍQUIDA (bruto −
      // taxa do canal) como PREVISTA (PENDENTE, editável) na DATA DE RECEBIMENTO (Pix
      // D+0, cartão D+2). A artesã confirma em massa depois. Idempotente por referencia.
      const CANAIS_PAGAMENTO_MANUAL = ['Direta', 'Instagram', 'WhatsApp', 'Outros']
      const fimDoFluxo = (novoStatus === 'ENVIADO' || novoStatus === 'PRONTO')
      const flagsFin = await flagsCanais(workspaceId)
      const usaCanaisFin = flagsFin.modulo && flagsFin.financeiro
      if (fimDoFluxo && pedido.valor && (usaCanaisFin || CANAIS_PAGAMENTO_MANUAL.includes(pedido.canal || ''))) {
        try {
          const hoje = new Date().toISOString().split('T')[0]
          const bruto = parseFloat(String(pedido.valor)) || 0

          // Quando o lançamento por canal está ON: líquido + data de recebimento + PREVISTA.
          let valorLanc = bruto, dataLanc = hoje, statusLanc: 'PAGO' | 'PENDENTE' = 'PAGO', obs: string | null = null
          if (usaCanaisFin) {
            const taxa = await resolverTaxa(workspaceId, pedido.canal || '', { preco: bruto })
            const liquido = calcularLiquido(bruto, taxa)
            valorLanc = liquido
            dataLanc = dataRecebimento(new Date(), taxa, pedido.metodoPagamento)
            statusLanc = 'PENDENTE' // receita PREVISTA (editável) → confirma em massa
            obs = `[canal] bruto=${bruto.toFixed(2)} taxa=${valorTaxa(bruto, taxa).toFixed(2)} liq=${liquido.toFixed(2)}`
          }

          const refsBusca: string[] = [pedido.numero, pedidoId].filter(Boolean) as string[]
          const pendentes = await prisma.$queryRaw`
            SELECT id, valor::float AS valor FROM "FinLancamento"
            WHERE "workspaceId" = ${workspaceId} AND "tipo" = 'RECEITA' AND "status" = 'PENDENTE'
              AND "referencia" = ANY(${refsBusca}::text[]) AND "descricao" LIKE '[saldo-auto]%'
            ORDER BY "createdAt" ASC LIMIT 1
          ` as { id: string; valor: number }[]

          if (pendentes.length > 0) {
            const pend = pendentes[0]
            if (usaCanaisFin) {
              // Vira PREVISTA líquida na data certa (continua PENDENTE p/ confirmar em massa).
              await prisma.$executeRaw`
                UPDATE "FinLancamento"
                SET "valor" = ${valorLanc}, "data" = ${dataLanc}::date, "canal" = ${pedido.canal || null},
                    "observacoes" = ${obs}, "status" = 'PENDENTE', "dataRealizada" = NULL, "valorRealizado" = NULL
                WHERE "id" = ${pend.id}
              `
            } else {
              // Comportamento atual: PAGO pelo valor cheio.
              await prisma.$executeRaw`
                UPDATE "FinLancamento"
                SET "status" = 'PAGO', "dataRealizada" = ${hoje}::date, "valorRealizado" = ${pend.valor}
                WHERE "id" = ${pend.id}
              `
            }
          } else {
            // Sem pendente → cria. (manual antigo → PAGO cheio; canais-fin → PREVISTA líquida)
            const descLan = `[saldo-auto] Pedido #${pedido.numero || pedidoId} — ${pedido.canal || 'Direta'}`
            await prisma.$executeRaw`
              INSERT INTO "FinLancamento"
                ("id","workspaceId","tipo","categoriaId","descricao","valor","data","status",
                 "dataRealizada","valorRealizado","canal","referencia","observacoes",
                 "recorrenciaId","recorrencia","parcela","totalParcelas","arquivo","arquivoNome","arquivoTipo")
              VALUES (
                ${gerarId()}, ${workspaceId}, 'RECEITA', NULL, ${descLan}, ${valorLanc}, ${dataLanc}::date, ${statusLanc},
                ${statusLanc === 'PAGO' ? hoje : null}::date, ${statusLanc === 'PAGO' ? valorLanc : null},
                ${pedido.canal || 'Direta'}, ${pedido.numero || pedidoId}, ${obs},
                NULL, NULL, NULL, NULL, NULL, NULL, NULL
              )
            `
          }
        } catch (eLanc) {
          console.error('[workflow] Erro ao lançar receita na conclusão:', eLanc)
        }
      }

      // ── Baixa automática de estoque de materiais (na expedição) ─────
      if (novoStatus === 'ENVIADO') {
        console.log('[workflow] Pedido ENVIADO, disparando baixa de estoque...', { pedidoId, numero: pedido.numero })
        try {
          // Parse dos produtos do pedido (vem de camposExtras.produtos)
          let produtosPedido: any[] = []
          try {
            const extras = typeof pedido.camposExtras === 'string'
              ? JSON.parse(pedido.camposExtras)
              : pedido.camposExtras
            if (extras && Array.isArray(extras.produtos)) {
              produtosPedido = extras.produtos
              console.log('[workflow] Produtos extraídos do camposExtras:', produtosPedido.length)
            }
          } catch (e) {
            console.error('[workflow] Erro ao parsear camposExtras:', e)
          }

          // Fallback: se não tem array em camposExtras, usa o campo produto + quantidade
          if (produtosPedido.length === 0) {
            if (pedido.produto) {
              produtosPedido = [{ nome: pedido.produto, quantidade: pedido.quantidade || 1 }]
              console.log('[workflow] Fallback usado — produto:', pedido.produto, 'qtd:', pedido.quantidade || 1)
            } else {
              console.log('[workflow] ⚠️ Sem produto e sem camposExtras — nada a baixar')
            }
          }

          if (produtosPedido.length > 0) {
            const resBaixa = await baixarEstoqueMaterial({
              workspaceId,
              pedidoId,
              numero: pedido.numero || pedidoId,
              produtos: produtosPedido,
              usuarioNome: session.user.name || 'Sistema',
            })

            console.log('[workflow] Resultado baixa:', {
              ok: resBaixa.ok,
              baixados: resBaixa.materiaisBaixados.length,
              naoEncontrados: resBaixa.produtosNaoEncontrados,
              avisos: resBaixa.avisos,
            })

            if (resBaixa.materiaisBaixados.length > 0) {
              const resumoMateriais = resBaixa.materiaisBaixados
                .slice(0, 5)
                .map((m: any) => `${m.nomeMaterial}: -${m.quantidadeBaixada.toFixed(2)}`)
                .join(', ')
              try {
                await prisma.$executeRaw`
                  INSERT INTO "PedidoHistorico" ("id","pedidoId","workspaceId","tipo","descricao","usuarioNome")
                  VALUES (${gerarId()}, ${pedidoId}, ${workspaceId}, 'BAIXA_ESTOQUE',
                    ${`Baixa automática: ${resumoMateriais}${resBaixa.materiaisBaixados.length > 5 ? ` (+${resBaixa.materiaisBaixados.length - 5} outros)` : ''}`},
                    ${session.user.name || 'Sistema'})
                `
              } catch (eHist) {
                console.error('[workflow] Erro ao gravar histórico de baixa:', eHist)
              }
            }
            if (resBaixa.avisos.length > 0) {
              console.warn('[workflow] baixa estoque avisos:', resBaixa.avisos)
            }
          }
        } catch (eEst) {
          console.error('[workflow] Erro na baixa de estoque:', eEst)
        }
      }

      // ── VPS Stars: +1 pt por expedição (DESATIVADO até 01/06/2026) ───
      // await pontuarStars({ workspaceId, motivo: 'EXPEDICAO', pontos: 1, descricao: 'Pedido expedido' }).catch(() => {})

      return NextResponse.json({ ok: true, acao: 'concluido', mensagem: 'Pedido concluído!' })
    }

    // Ativa próximo setor — usa UPSERT para garantir que existe mesmo se criado depois
    const existeProximo = await prisma.$queryRaw`
      SELECT id FROM "PedidoSetor"
      WHERE "pedidoId" = ${pedidoId} AND "setorId" = ${proximoSetor.id}
    ` as any[]

    if (existeProximo.length > 0) {
      // Já existe — só atualiza
      await prisma.$executeRaw`
        UPDATE "PedidoSetor"
        SET status = 'EM_ANDAMENTO', "iniciadoEm" = NULL, "concluidoEm" = NULL
        WHERE "pedidoId" = ${pedidoId} AND "setorId" = ${proximoSetor.id}
      `
    } else {
      // Não existe (setor criado depois que o pedido foi iniciado) — cria agora
      const novoId = gerarId()
      await prisma.$executeRaw`
        INSERT INTO "PedidoSetor" ("id","workspaceId","pedidoId","setorId","status")
        VALUES (${novoId}, ${workspaceId}, ${pedidoId}, ${proximoSetor.id}, 'EM_ANDAMENTO')
      `
    }

    // Atualiza ponteiro do setor atual
    try {
      await prisma.$executeRaw`
        DELETE FROM "PedidoSetorAtual"
        WHERE "pedidoId" = ${pedidoId} AND "workspaceId" = ${workspaceId}
      `
      await prisma.$executeRaw`
        INSERT INTO "PedidoSetorAtual" ("pedidoId","workspaceId","setorId","updatedAt")
        VALUES (${pedidoId}, ${workspaceId}, ${proximoSetor.id}, NOW())
      `
    } catch {}

    // Status do pedido ao ENTRAR no próximo setor: se o próximo é a EXPEDIÇÃO, a produção
    // está concluída e ele fica PRONTO (aguardando expedir). Só vira ENVIADO quando a
    // expedição for concluída (branch acima). Caso contrário segue EM_PRODUCAO.
    const proximoEhExpedicao = ehSetorExpedicao(proximoSetor, temExpedicaoMarcada)
    await prisma.$executeRaw`
      UPDATE "Order" SET status = ${proximoEhExpedicao ? 'PRONTO' : 'EM_PRODUCAO'}, "updatedAt" = NOW()
      WHERE id = ${pedidoId} AND "workspaceId" = ${workspaceId}
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
