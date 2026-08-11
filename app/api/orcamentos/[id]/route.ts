import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { totalOrcamento } from '@/lib/orcamentoTotal'
import { garantirClienteCrm } from '@/lib/clienteCrm'

const COLS_ORC = `"id","workspaceId","numero","titulo","clienteId","clienteNome","clienteEmail","clienteWhatsapp","canal","produto","quantidade","valor",COALESCE("frete",0) AS "frete",COALESCE("descontoValor",0) AS "descontoValor",COALESCE("descontoTipo",'valor') AS "descontoTipo","observacoes","status","pedidoId","camposExtras","politicasEmpresa","tokenAprovacao","aprovadoEm",TO_CHAR("dataValidade",'YYYY-MM-DD') AS "dataValidade",TO_CHAR("dataEnvioEstimada",'YYYY-MM-DD') AS "dataEnvioEstimada"`

// Garante colunas de título, vínculo com cliente do CRM e DESCONTO (idempotente)
let colsOk = false
async function ensureColunasOrcamento() {
  if (colsOk) return
  await prisma.$executeRawUnsafe(`ALTER TABLE "Orcamento" ADD COLUMN IF NOT EXISTS "titulo" text`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Orcamento" ADD COLUMN IF NOT EXISTS "clienteId" text`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Orcamento" ADD COLUMN IF NOT EXISTS "descontoValor" numeric`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Orcamento" ADD COLUMN IF NOT EXISTS "descontoTipo" text`)
  colsOk = true
}

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (typeof obj === 'object' && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') {
    const r: any = {}
    for (const k of Object.keys(obj)) r[k] = serialize(obj[k])
    return r
  }
  return obj
}

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// PUT — editar orçamento ou mudar status (incluindo aprovar → virar pedido)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role === 'OPERADOR')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId
    await ensureColunasOrcamento()
    const body = await req.json()

    const [orc] = await prisma.$queryRaw`
      SELECT ${Prisma.raw(COLS_ORC)} FROM "Orcamento"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!orc) return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 })

    // ── APROVAR → converter em pedido ──────────────────────────────────────
    if (body.status === 'APROVADO' && orc.status !== 'APROVADO') {
      const pedidoId  = gerarId()
      const numeroPed = orc.clienteNome.substring(0, 3).toUpperCase() + '-' + Date.now().toString(36).toUpperCase()
      const deDate    = orc.dataEnvioEstimada ? new Date(orc.dataEnvioEstimada) : null
      const hoje      = new Date()

      // Buscar itens do orçamento
      const itensOrc = await prisma.$queryRaw`
        SELECT "produto","quantidade","valorUnitario","isKit","qtdKitPecas","ordem"
        FROM "OrcamentoItem"
        WHERE "orcamentoId" = ${id}
        ORDER BY "ordem" ASC
      ` as any[]

      // Montar camposExtras com múltiplos produtos (padrão do sistema)
      let camposExtrasPedido: any = {}
      try {
        const ex = orc.camposExtras ? JSON.parse(String(orc.camposExtras)) : null
        const vals = ex?.camposValores
        if (vals && Object.keys(vals).length > 0) camposExtrasPedido = { ...vals }
      } catch {}

      if (itensOrc.length > 0) {
        camposExtrasPedido.produtos = itensOrc.map((it: any) => ({
          nome: it.produto,
          quantidade: Number(it.quantidade) || 1,
          valorUnitario: it.valorUnitario ? Number(it.valorUnitario) : null,
          isKit: !!it.isKit,
          qtdKitPecas: Number(it.qtdKitPecas) || 0,
        }))
      }

      const camposExtrasStr = Object.keys(camposExtrasPedido).length > 0
        ? JSON.stringify(camposExtrasPedido) : null

      await prisma.$executeRaw`
        INSERT INTO "Order" (
          "id","workspaceId","numero","destinatario","idCliente",
          "canal","produto","quantidade","valor",
          "dataEntrada","dataEnvio","observacoes","prioridade","status",
          "endereco","camposExtras"
        ) VALUES (
          ${pedidoId},${workspaceId},${numeroPed},${orc.clienteNome},${null},
          ${orc.canal ?? null},${orc.produto},${orc.quantidade},${orc.valor ? parseFloat(String(orc.valor)) : null},
          ${hoje},${deDate},${orc.observacoes ?? null},'NORMAL','ABERTO',
          ${null},${camposExtrasStr}
        )
      `

      try {
        const histId = gerarId()
        await prisma.$executeRaw`
          INSERT INTO "PedidoHistorico" ("id","pedidoId","workspaceId","tipo","descricao","usuarioNome")
          VALUES (${histId},${pedidoId},${workspaceId},'CRIACAO',
                  ${'Pedido criado a partir do orçamento ' + orc.numero},${session.user.name})
        `
      } catch {}

      await prisma.$executeRaw`
        UPDATE "Orcamento"
        SET "status" = 'APROVADO', "pedidoId" = ${pedidoId}, "updatedAt" = NOW()
        WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
      `

      const [atualizado] = await prisma.$queryRaw`
        SELECT ${Prisma.raw(COLS_ORC)} FROM "Orcamento" WHERE "id" = ${id}
      ` as any[]

      return NextResponse.json(serialize({ orcamento: atualizado, pedidoId }))
    }

    // ── EDITAR campos normais ──────────────────────────────────────────────
    const {
      titulo, clienteId, clienteNome, clienteEmail, clienteWhatsapp,
      canal, produto, quantidade, valor, descontoValor, descontoTipo,
      dataValidade, dataEnvioEstimada, observacoes, status, politicasEmpresa,
      itens,
    } = body

    if (titulo !== undefined) {
      await ensureColunasOrcamento()
      const tv = titulo && String(titulo).trim() ? String(titulo).trim().slice(0, 200) : null
      await prisma.$executeRaw`UPDATE "Orcamento" SET "titulo"=${tv} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
    }
    if (clienteId !== undefined) {
      await ensureColunasOrcamento()
      let cv = clienteId && String(clienteId).trim() ? String(clienteId).trim() : null
      // Cliente NOVO na edição (sem clienteId, mas com nome digitado) → cria/vincula no CRM.
      if (!cv && String(clienteNome ?? '').trim()) {
        cv = await garantirClienteCrm(workspaceId, { nome: clienteNome, telefone: clienteWhatsapp, email: clienteEmail, origem: 'orcamento' })
      }
      await prisma.$executeRaw`UPDATE "Orcamento" SET "clienteId"=${cv} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
    }
    if (clienteNome !== undefined)
      await prisma.$executeRaw`UPDATE "Orcamento" SET "clienteNome"=${clienteNome} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
    if (clienteEmail !== undefined)
      await prisma.$executeRaw`UPDATE "Orcamento" SET "clienteEmail"=${clienteEmail} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
    if (clienteWhatsapp !== undefined)
      await prisma.$executeRaw`UPDATE "Orcamento" SET "clienteWhatsapp"=${clienteWhatsapp} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
    if (canal !== undefined)
      await prisma.$executeRaw`UPDATE "Orcamento" SET "canal"=${canal} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
    if (produto !== undefined)
      await prisma.$executeRaw`UPDATE "Orcamento" SET "produto"=${produto} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
    if (quantidade !== undefined)
      await prisma.$executeRaw`UPDATE "Orcamento" SET "quantidade"=${parseInt(String(quantidade))||1} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
    if (valor !== undefined)
      await prisma.$executeRaw`UPDATE "Orcamento" SET "valor"=${valor !== null && valor !== '' ? parseFloat(String(valor)) : null} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
    if (dataValidade !== undefined) {
      const dv = dataValidade ? new Date(dataValidade + 'T12:00:00Z') : null
      await prisma.$executeRaw`UPDATE "Orcamento" SET "dataValidade"=${dv} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
    }
    if (dataEnvioEstimada !== undefined) {
      const de = dataEnvioEstimada ? new Date(dataEnvioEstimada + 'T12:00:00Z') : null
      await prisma.$executeRaw`UPDATE "Orcamento" SET "dataEnvioEstimada"=${de} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
    }
    if (observacoes !== undefined)
      await prisma.$executeRaw`UPDATE "Orcamento" SET "observacoes"=${observacoes} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
    if (politicasEmpresa !== undefined)
      await prisma.$executeRaw`UPDATE "Orcamento" SET "politicasEmpresa"=${politicasEmpresa} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
    if (body.camposExtras !== undefined) {
      const extrasStr = body.camposExtras
        ? (typeof body.camposExtras === 'string' ? body.camposExtras : JSON.stringify(body.camposExtras))
        : null
      await prisma.$executeRaw`UPDATE "Orcamento" SET "camposExtras"=${extrasStr} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
    }
    if (status !== undefined && status !== 'APROVADO')
      await prisma.$executeRaw`UPDATE "Orcamento" SET "status"=${status} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`

    // Editar itens: delete all + insert all (mais simples e seguro)
    if (Array.isArray(itens)) {
      await prisma.$executeRaw`DELETE FROM "OrcamentoItem" WHERE "orcamentoId" = ${id}`
      for (let i = 0; i < itens.length; i++) {
        const it = itens[i]
        const nomeProd = String(it.nomeProduto || it.produto || '').trim()
        if (!nomeProd) continue
        const itemId  = gerarId()
        const qtdItem = parseInt(String(it.quantidade)) || 1
        const vlrItem = it.valorUnitario !== null && it.valorUnitario !== undefined && it.valorUnitario !== ''
          ? parseFloat(String(it.valorUnitario))
          : (it.valorItem !== null && it.valorItem !== undefined && it.valorItem !== ''
              ? parseFloat(String(it.valorItem)) : null)
        const isKit = !!it.isKit
        const qtdKit = parseInt(String(it.qtdKitPecas || 0)) || 0
        const variacaoId = it.variacaoId || null
        const descItem = it.desconto !== null && it.desconto !== undefined && it.desconto !== '' ? parseFloat(String(it.desconto)) : 0
        const descTipo = it.descontoTipo === 'percentual' ? 'percentual' : 'valor'
        await prisma.$executeRaw`
          INSERT INTO "OrcamentoItem" (
            "id","orcamentoId","workspaceId","produto","quantidade",
            "valorUnitario","isKit","qtdKitPecas","ordem","variacaoId","desconto","descontoTipo"
          ) VALUES (
            ${itemId},${id},${workspaceId},${nomeProd},${qtdItem},
            ${vlrItem},${isKit},${qtdKit},${i},${variacaoId},${descItem},${descTipo}
          )
        `
      }
    }

    // Frete (novo ou o atual)
    const freteFinal = body.frete !== undefined
      ? (body.frete !== null && body.frete !== '' ? parseFloat(String(body.frete)) : 0)
      : (Number(orc.frete) || 0)
    if (body.frete !== undefined)
      await prisma.$executeRaw`UPDATE "Orcamento" SET "frete"=${freteFinal} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`

    // Desconto do orçamento (novo ou o atual). Editar/limpar recalcula o total.
    let descValFinal = Number(orc.descontoValor) || 0
    let descTipoFinal = orc.descontoTipo === 'percentual' ? 'percentual' : 'valor'
    if (descontoValor !== undefined) {
      descValFinal = descontoValor !== null && descontoValor !== '' ? Math.max(0, parseFloat(String(descontoValor)) || 0) : 0
      descTipoFinal = descontoTipo === 'percentual' ? 'percentual' : 'valor'
      await prisma.$executeRaw`UPDATE "Orcamento" SET "descontoValor"=${descValFinal}, "descontoTipo"=${descTipoFinal} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
    }

    // Total autoritativo: Σ itens (líquido) − desconto do orçamento + frete.
    // Recalcula sempre que itens, frete OU desconto mudarem (lê o estado final dos itens).
    if (Array.isArray(itens) || body.frete !== undefined || descontoValor !== undefined) {
      const itensCalc = Array.isArray(itens)
        ? itens.map((it: any) => ({ quantidade: it.quantidade, valorUnitario: it.valorUnitario ?? it.valorItem, desconto: it.desconto, descontoTipo: it.descontoTipo }))
        : (await prisma.$queryRaw`
            SELECT "quantidade","valorUnitario",COALESCE("desconto",0) AS "desconto",COALESCE("descontoTipo",'valor') AS "descontoTipo"
            FROM "OrcamentoItem" WHERE "orcamentoId"=${id}
          ` as any[])
      const totalRecalc = totalOrcamento(itensCalc, freteFinal, descValFinal, descTipoFinal)
      await prisma.$executeRaw`UPDATE "Orcamento" SET "valor"=${totalRecalc} WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
    }

    await prisma.$executeRaw`UPDATE "Orcamento" SET "updatedAt"=NOW() WHERE "id"=${id} AND "workspaceId"=${workspaceId}`

    const [atualizado] = await prisma.$queryRaw`SELECT ${Prisma.raw(COLS_ORC)} FROM "Orcamento" WHERE "id"=${id}` as any[]
    const itensAtuais = await prisma.$queryRaw`
      SELECT "id","orcamentoId","produto","quantidade","valorUnitario","isKit","qtdKitPecas","ordem","variacaoId",
             COALESCE("desconto",0) AS "desconto", COALESCE("descontoTipo",'valor') AS "descontoTipo"
      FROM "OrcamentoItem" WHERE "orcamentoId"=${id} ORDER BY "ordem" ASC
    ` as any[]

    return NextResponse.json(serialize({ ...atualizado, itens: itensAtuais }))
  } catch (error) {
    console.error('PUT /api/orcamentos/[id]:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE — remover orçamento (só RASCUNHO ou RECUSADO)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role === 'OPERADOR')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    const [orc] = await prisma.$queryRaw`
      SELECT status FROM "Orcamento" WHERE "id"=${id} AND "workspaceId"=${workspaceId}
    ` as any[]

    if (!orc) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    if (orc.status === 'APROVADO')
      return NextResponse.json({ error: 'Não é possível excluir orçamento aprovado' }, { status: 400 })

    // FK ON DELETE CASCADE cuida dos itens, mas DELETE explícito é defensivo
    await prisma.$executeRaw`DELETE FROM "OrcamentoItem" WHERE "orcamentoId"=${id}`
    await prisma.$executeRaw`DELETE FROM "Orcamento" WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/orcamentos/[id]:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
