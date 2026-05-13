import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { pontuarStars } from '@/lib/stars'
import { baixarEstoqueMaterial, reverterBaixaEstoque } from '@/lib/baixarEstoqueMaterial'

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
      SELECT id, status, canal, numero, valor, produto, quantidade, "camposExtras"
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

    // Setor atual (EM_ANDAMENTO com iniciadoEm preenchido, ou sem iniciadoEm para mover)
    const setorAtualRows = await prisma.$queryRaw`
      SELECT ps.id, ps."setorId", sc.nome, sc.ordem
      FROM "PedidoSetor" ps
      JOIN "SetorConfig" sc ON sc.id = ps."setorId"
      WHERE ps."pedidoId"    = ${pedidoId}
        AND ps."workspaceId" = ${workspaceId}
        AND ps."status"      = 'EM_ANDAMENTO'
      ORDER BY ps."iniciadoEm" DESC NULLS LAST
      LIMIT 1
    ` as any[]

    if (!setorAtualRows.length)
      return NextResponse.json({ error: 'Pedido não está em andamento em nenhum setor. Clique em Iniciar primeiro.' }, { status: 400 })

    const setorAtual = setorAtualRows[0]
    const ordemAtual = Number(setorAtual.ordem)

    // ── AÇÃO: Devolver ao setor anterior ─────────────────────
    if (devolver) {
      // Se setorDestinoId fornecido, usa ele; senão pega o setor anterior
      // Usa posição no array para encontrar setor anterior (compatível com fluxo e legado)
      const idxAtualDev = todosSetores.findIndex((s: any) => s.id === setorAtual.setorId)
      let setorAnterior = setorDestinoId
        ? todosSetores.find((s: any) => s.id === setorDestinoId)
        : idxAtualDev > 0 ? todosSetores[idxAtualDev - 1] : undefined

      // Se é o primeiro setor e não foi especificado destino, retorna para o próprio setor (reiniciar)
      if (!setorAnterior && !setorDestinoId) {
        setorAnterior = todosSetores.find((s: any) => s.id === setorAtual.setorId)
      }

      if (!setorAnterior)
        return NextResponse.json({ error: 'Setor de destino não encontrado' }, { status: 400 })

      // Atual → PENDENTE (some da tela do setor atual, evita duplicação)
      // Usa o id da linha PedidoSetor diretamente para garantir o match
      await prisma.$executeRaw`
        UPDATE "PedidoSetor"
        SET status = 'PENDENTE', "concluidoEm" = NULL, "iniciadoEm" = NULL
        WHERE id = ${setorAtual.id}
      `

      // Setor destino → DEVOLVIDO com motivo — UPSERT
      const existeAnterior = await prisma.$queryRaw`
        SELECT id FROM "PedidoSetor"
        WHERE "pedidoId" = ${pedidoId} AND "setorId" = ${setorAnterior.id}
      ` as any[]

      if (existeAnterior.length > 0) {
        await prisma.$executeRaw`
          UPDATE "PedidoSetor"
          SET status = 'DEVOLVIDO', "iniciadoEm" = NULL, "concluidoEm" = NULL,
              "observacoes" = ${motivo || null}
          WHERE "pedidoId" = ${pedidoId} AND "setorId" = ${setorAnterior.id}
        `
      } else {
        const novoIdDev = gerarId()
        await prisma.$executeRaw`
          INSERT INTO "PedidoSetor" ("id","workspaceId","pedidoId","setorId","status","observacoes")
          VALUES (${novoIdDev}, ${workspaceId}, ${pedidoId}, ${setorAnterior.id}, 'DEVOLVIDO', ${motivo || null})
        `
      }

      try {
        const histId = gerarId()
        await prisma.$executeRaw`
          INSERT INTO "PedidoHistorico" ("id","pedidoId","workspaceId","tipo","descricao","usuarioNome")
          VALUES (${histId}, ${pedidoId}, ${workspaceId}, 'DEVOLVIDO',
            ${setorAtual.nome + ' → devolvido para → ' + setorAnterior.nome + (motivo ? ' | Motivo: ' + motivo : '')}, ${session.user.name})
        `
      } catch {}

      return NextResponse.json({ ok: true, acao: 'devolvido', setorAnterior: setorAnterior.nome })
    }

    // ── AÇÃO: Avançar para próximo setor (Concluir) ───────────
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
      // Último setor — se for Expedição → ENVIADO, senão → CONCLUIDO
      const isExpedicao = setorAtual.nome?.toLowerCase().includes('expedi')
      const novoStatus  = isExpedicao ? 'ENVIADO' : 'CONCLUIDO'
      await prisma.$executeRaw`
        UPDATE "Order" SET status = ${novoStatus}, "updatedAt" = NOW()
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

      // ── Lançamento automático — Venda Direta ─────────────────
      // Quando pedido é ENVIADO e canal é Direta → cria receita no financeiro automaticamente
      if (novoStatus === 'ENVIADO' && pedido.canal === 'Direta' && pedido.valor) {
        try {
          const lancId  = gerarId()
          const hoje    = new Date().toISOString().split('T')[0]
          const vlr     = parseFloat(String(pedido.valor))
          const descLan = `Pedido #${pedido.numero || pedidoId} — Venda Direta`
          await prisma.$executeRaw`
            INSERT INTO "FinLancamento"
              ("id","workspaceId","tipo","categoriaId","descricao","valor","data","status",
               "dataRealizada","valorRealizado","canal","referencia","observacoes",
               "recorrenciaId","recorrencia","parcela","totalParcelas",
               "arquivo","arquivoNome","arquivoTipo")
            VALUES (
              ${lancId}, ${workspaceId}, 'RECEITA', NULL,
              ${descLan}, ${vlr}, ${hoje}::date, 'PAGO',
              ${hoje}::date, ${vlr}, 'Direta', ${pedidoId}, NULL,
              NULL, NULL, NULL, NULL, NULL, NULL, NULL
            )
          `
        } catch (eLanc) {
          // Silencioso — não bloqueia a conclusão do pedido
          console.error('[workflow] Erro ao criar lançamento automático:', eLanc)
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

      // ── VPS Stars: +1 pt por expedição ───────────────────────────
      await pontuarStars({
          workspaceId,
          motivo: 'EXPEDICAO',
          pontos: 1,
          descricao: `Pedido expedido`,
        }).catch(() => {})

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
