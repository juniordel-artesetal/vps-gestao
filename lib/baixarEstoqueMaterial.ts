// lib/baixarEstoqueMaterial.ts
// Baixa automática de estoque de materiais ao expedir pedido
// Estratégia: match por NOME do produto/variação (pedido não armazena variacaoId)

import { prisma } from '@/lib/prisma'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

interface ProdutoPedido {
  nome: string
  quantidade: number
  valorUnitario?: number
}

interface ResultadoBaixa {
  ok: boolean
  materiaisBaixados: Array<{
    materialId: string
    nomeMaterial: string
    quantidadeBaixada: number
    saldoApos: number
  }>
  produtosNaoEncontrados: string[]
  avisos: string[]
}

/**
 * Baixa o estoque de materiais para um pedido expedido.
 * Pode ser revertida via reverterBaixaEstoque() se o pedido for cancelado.
 *
 * @param p workspaceId, pedidoId, numero, produtos (lista de produtos do pedido), usuarioNome
 * @returns lista de materiais baixados, avisos e erros não bloqueantes
 */
export async function baixarEstoqueMaterial(p: {
  workspaceId: string
  pedidoId: string
  numero: string
  produtos: ProdutoPedido[]
  usuarioNome: string
}): Promise<ResultadoBaixa> {
  const resultado: ResultadoBaixa = {
    ok: true,
    materiaisBaixados: [],
    produtosNaoEncontrados: [],
    avisos: [],
  }

  try {
    console.log('[baixarEstoqueMaterial] Iniciando', { pedidoId: p.pedidoId, numero: p.numero, totalProdutos: p.produtos?.length })

    // 1. Verificar se módulo está ativo
    const cfg = await prisma.$queryRaw`
      SELECT "moduloEstoqueMateriais" FROM "Workspace" WHERE id = ${p.workspaceId} LIMIT 1
    ` as any[]
    if (!cfg.length || !cfg[0].moduloEstoqueMateriais) {
      console.log('[baixarEstoqueMaterial] Módulo desativado, abortando')
      return { ...resultado, avisos: ['Módulo de estoque de materiais não está ativo'] }
    }

    if (!Array.isArray(p.produtos) || p.produtos.length === 0) {
      console.log('[baixarEstoqueMaterial] Sem produtos, abortando')
      return resultado
    }

    // 2. Para cada produto do pedido, achar variação por nome
    for (const prod of p.produtos) {
      const nomeBusca = prod.nome?.trim()
      if (!nomeBusca) continue

      console.log('[baixarEstoqueMaterial] Buscando variação para:', nomeBusca)

      // Match por nome — tenta múltiplas estratégias:
      // 1) Nome do pedido contém o nome da variação (ex: "saco preto — SACO TESTE" contém "SACO TESTE")
      // 2) Nome do pedido contém o nome do produto (ex: "saco preto — SACO TESTE" contém "saco preto")
      // 3) Nome da variação igual ao nome do pedido
      const variacoes = await prisma.$queryRaw`
        SELECT v.id, v.nome AS "variacaoNome", p.nome AS "produtoNome",
               v."produtoId", v.canal, v.tipo
        FROM "PrecVariacao" v
        JOIN "PrecProduto" p ON p.id = v."produtoId"
        WHERE p."workspaceId" = ${p.workspaceId}
          AND p.ativo = true
          AND (
            v.nome = ${nomeBusca}
            OR (v.nome IS NOT NULL AND v.nome != '' AND ${nomeBusca} ILIKE '%' || v.nome || '%')
            OR ${nomeBusca} ILIKE '%' || p.nome || '%'
          )
        LIMIT 1
      ` as any[]

      if (variacoes.length === 0) {
        console.log('[baixarEstoqueMaterial] ❌ Variação não encontrada para:', nomeBusca)
        resultado.produtosNaoEncontrados.push(nomeBusca)
        continue
      }
      const variacao = variacoes[0]
      console.log('[baixarEstoqueMaterial] ✓ Variação encontrada:', variacao.variacaoNome, '(produto:', variacao.produtoNome + ')')

      // 3. Buscar materiais da variação
      const materiais = await prisma.$queryRaw`
        SELECT mi.id, mi."materialId", mi."nomeMaterial",
               mi."qtdUsada"::float AS "qtdUsada",
               mi.rendimento::float AS rendimento
        FROM "PrecMaterialItem" mi
        WHERE mi."variacaoId" = ${variacao.id}
      ` as any[]

      console.log('[baixarEstoqueMaterial] Materiais encontrados:', materiais.length)

      if (materiais.length === 0) {
        resultado.avisos.push(`"${nomeBusca}" não tem materiais cadastrados na precificação`)
        continue
      }

      // 4. Para cada material, calcular baixa e descontar
      const qtdPedida = Number(prod.quantidade) || 1
      for (const mat of materiais) {
        const qtdUsada = Number(mat.qtdUsada) || 0
        const rendimento = Number(mat.rendimento) || 1
        if (qtdUsada <= 0 || rendimento <= 0) {
          console.log('[baixarEstoqueMaterial] Material', mat.nomeMaterial, 'sem qtdUsada/rendimento válidos')
          continue
        }

        const baixaPorUnidade = qtdUsada / rendimento
        const baixaTotal = baixaPorUnidade * qtdPedida

        console.log(`[baixarEstoqueMaterial] Baixando ${baixaTotal} de "${mat.nomeMaterial}" (${qtdUsada}/${rendimento} × ${qtdPedida})`)

        // Buscar saldo atual
        const saldoRows = await prisma.$queryRaw`
          SELECT "saldoAtual"::float AS "saldoAtual"
          FROM "EstMaterialSaldo"
          WHERE "workspaceId" = ${p.workspaceId} AND "materialId" = ${mat.materialId}
          LIMIT 1
        ` as any[]

        const saldoAtual = saldoRows.length ? Number(saldoRows[0].saldoAtual) : 0
        const novoSaldo = saldoAtual - baixaTotal

        // Aviso se saldo ficar negativo, mas não bloqueia
        if (novoSaldo < 0) {
          resultado.avisos.push(
            `Saldo de "${mat.nomeMaterial}" ficou negativo: ${novoSaldo.toFixed(2)} (usado ${baixaTotal.toFixed(2)})`
          )
        }

        // UPSERT no saldo
        if (saldoRows.length === 0) {
          await prisma.$executeRaw`
            INSERT INTO "EstMaterialSaldo" ("id","workspaceId","materialId","saldoAtual","estoqueMinimo","podeZerar","updatedAt")
            VALUES (${gerarId()}, ${p.workspaceId}, ${mat.materialId}, ${novoSaldo}, 0, false, NOW())
          `
        } else {
          await prisma.$executeRaw`
            UPDATE "EstMaterialSaldo"
            SET "saldoAtual" = ${novoSaldo}, "updatedAt" = NOW()
            WHERE "workspaceId" = ${p.workspaceId} AND "materialId" = ${mat.materialId}
          `
        }

        // Registrar movimento (sinal negativo = saída)
        await prisma.$executeRaw`
          INSERT INTO "EstMaterialMovimento" (
            "id","workspaceId","materialId","tipo","quantidade","saldoApos",
            "motivo","referencia","usuarioNome","createdAt"
          ) VALUES (
            ${gerarId()}, ${p.workspaceId}, ${mat.materialId}, 'BAIXA_VENDA',
            ${-Math.abs(baixaTotal)}, ${novoSaldo},
            ${`Pedido ${p.numero} expedido (${qtdPedida}x ${prod.nome.slice(0, 60)})`},
            ${p.numero}, ${p.usuarioNome}, NOW()
          )
        `

        console.log(`[baixarEstoqueMaterial] ✓ Movimento registrado: ${mat.nomeMaterial} -${baixaTotal} (novo saldo: ${novoSaldo})`)

        resultado.materiaisBaixados.push({
          materialId: mat.materialId,
          nomeMaterial: mat.nomeMaterial,
          quantidadeBaixada: baixaTotal,
          saldoApos: novoSaldo,
        })
      }
    }

    console.log('[baixarEstoqueMaterial] Concluído.', resultado.materiaisBaixados.length, 'materiais baixados')
    return resultado
  } catch (err: any) {
    console.error('[baixarEstoqueMaterial] ❌ Erro:', err)
    return { ...resultado, ok: false, avisos: [`Erro: ${err.message}`] }
  }
}

/**
 * Reverte a baixa de estoque de um pedido (caso o pedido seja cancelado após expedição).
 * Procura movimentos BAIXA_VENDA pelo `referencia` (número do pedido) e devolve ao saldo.
 */
export async function reverterBaixaEstoque(p: {
  workspaceId: string
  numero: string
  usuarioNome: string
}): Promise<ResultadoBaixa> {
  const resultado: ResultadoBaixa = {
    ok: true,
    materiaisBaixados: [],
    produtosNaoEncontrados: [],
    avisos: [],
  }

  try {
    // Buscar todos os movimentos de baixa deste pedido
    const movs = await prisma.$queryRaw`
      SELECT id, "materialId", quantidade::float AS quantidade
      FROM "EstMaterialMovimento"
      WHERE "workspaceId" = ${p.workspaceId}
        AND "referencia" = ${p.numero}
        AND tipo = 'BAIXA_VENDA'
    ` as any[]

    if (movs.length === 0) {
      return { ...resultado, avisos: ['Nenhuma baixa anterior encontrada para reverter'] }
    }

    for (const mov of movs) {
      const qtdReverter = Math.abs(Number(mov.quantidade))

      // Buscar saldo atual e devolver
      const saldoRows = await prisma.$queryRaw`
        SELECT "saldoAtual"::float AS "saldoAtual"
        FROM "EstMaterialSaldo"
        WHERE "workspaceId" = ${p.workspaceId} AND "materialId" = ${mov.materialId}
        LIMIT 1
      ` as any[]

      const saldoAtual = saldoRows.length ? Number(saldoRows[0].saldoAtual) : 0
      const novoSaldo = saldoAtual + qtdReverter

      await prisma.$executeRaw`
        UPDATE "EstMaterialSaldo"
        SET "saldoAtual" = ${novoSaldo}, "updatedAt" = NOW()
        WHERE "workspaceId" = ${p.workspaceId} AND "materialId" = ${mov.materialId}
      `

      // Buscar nome do material para o log
      const matRows = await prisma.$queryRaw`
        SELECT nome FROM "PrecMaterial" WHERE id = ${mov.materialId} LIMIT 1
      ` as any[]
      const nomeMaterial = matRows[0]?.nome || mov.materialId

      // Registrar movimento de reversão
      await prisma.$executeRaw`
        INSERT INTO "EstMaterialMovimento" (
          "id","workspaceId","materialId","tipo","quantidade","saldoApos",
          "motivo","referencia","usuarioNome","createdAt"
        ) VALUES (
          ${gerarId()}, ${p.workspaceId}, ${mov.materialId}, 'REVERSAO_VENDA',
          ${qtdReverter}, ${novoSaldo},
          ${`Pedido ${p.numero} cancelado — reversão da baixa`},
          ${p.numero}, ${p.usuarioNome}, NOW()
        )
      `

      resultado.materiaisBaixados.push({
        materialId: mov.materialId,
        nomeMaterial,
        quantidadeBaixada: -qtdReverter,
        saldoApos: novoSaldo,
      })
    }

    return resultado
  } catch (err: any) {
    console.error('[reverterBaixaEstoque]', err)
    return { ...resultado, ok: false, avisos: [`Erro: ${err.message}`] }
  }
}
