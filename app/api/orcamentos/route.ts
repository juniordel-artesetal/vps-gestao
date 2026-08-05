import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { totalOrcamento } from '@/lib/orcamentoTotal'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

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

// GET — lista orçamentos do workspace (com itens agregados)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const workspaceId = session.user.workspaceId
    await ensureColunasOrcamento()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || null
    const busca  = searchParams.get('busca')  || null
    const buscaLike = busca ? `%${busca}%` : null

    const orcamentos = await prisma.$queryRaw`
      SELECT
        o."id", o."workspaceId", o."numero", o."titulo", o."clienteId",
        o."clienteNome", o."clienteEmail",
        o."clienteWhatsapp", o."canal", o."produto", o."quantidade", o."valor",
        COALESCE(o."frete", 0) AS "frete",
        COALESCE(o."descontoValor", 0) AS "descontoValor", COALESCE(o."descontoTipo", 'valor') AS "descontoTipo",
        o."observacoes", o."status", o."pedidoId", o."camposExtras",
        o."politicasEmpresa", o."tokenAprovacao", o."aprovadoEm",
        TO_CHAR(o."dataValidade",      'YYYY-MM-DD') AS "dataValidade",
        TO_CHAR(o."dataEnvioEstimada", 'YYYY-MM-DD') AS "dataEnvioEstimada",
        TO_CHAR(o."createdAt",         'YYYY-MM-DD') AS "createdAt"
      FROM "Orcamento" o
      WHERE o."workspaceId" = ${workspaceId}
        AND (${status}::text IS NULL OR o."status" = ${status})
        AND (${buscaLike}::text IS NULL
             OR o."clienteNome" ILIKE ${buscaLike}
             OR o."titulo"      ILIKE ${buscaLike}
             OR o."produto"     ILIKE ${buscaLike}
             OR o."numero"      ILIKE ${buscaLike})
      ORDER BY o."createdAt" DESC
    ` as any[]

    // Carregar itens de todos os orçamentos em uma única query
    const ids = orcamentos.map((o: any) => o.id)
    let itensMap: Record<string, any[]> = {}
    if (ids.length > 0) {
      const itens = await prisma.$queryRaw`
        SELECT
          "id", "orcamentoId", "produto", "quantidade", "valorUnitario",
          "isKit", "qtdKitPecas", "ordem", "variacaoId",
          COALESCE("desconto", 0) AS "desconto", COALESCE("descontoTipo", 'valor') AS "descontoTipo"
        FROM "OrcamentoItem"
        WHERE "orcamentoId" = ANY(${ids}::text[])
        ORDER BY "ordem" ASC, "createdAt" ASC
      ` as any[]
      for (const it of itens) {
        if (!itensMap[it.orcamentoId]) itensMap[it.orcamentoId] = []
        itensMap[it.orcamentoId].push(it)
      }
    }

    const result = orcamentos.map((o: any) => ({ ...o, itens: itensMap[o.id] || [] }))
    return NextResponse.json(serialize(result))
  } catch (error) {
    console.error('GET /api/orcamentos:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — criar orçamento com múltiplos itens
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role === 'OPERADOR')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const body = await req.json()
    const {
      titulo, clienteId, clienteNome, clienteEmail, clienteWhatsapp,
      canal, produto, quantidade, valor, frete, descontoValor, descontoTipo,
      dataValidade, dataEnvioEstimada, observacoes, camposExtras, politicasEmpresa,
      itens,
    } = body

    if (!clienteNome || !produto)
      return NextResponse.json({ error: 'Cliente e produto são obrigatórios' }, { status: 400 })

    const workspaceId = session.user.workspaceId
    await ensureColunasOrcamento()
    const tituloVal = titulo && String(titulo).trim() ? String(titulo).trim().slice(0, 200) : null
    const clienteIdVal = clienteId && String(clienteId).trim() ? String(clienteId).trim() : null
    // Desconto do orçamento (% ou R$). 0/ausente = sem desconto.
    const descVal  = descontoValor !== null && descontoValor !== undefined && descontoValor !== '' ? Math.max(0, parseFloat(String(descontoValor)) || 0) : 0
    const descTipo = descontoTipo === 'percentual' ? 'percentual' : 'valor'
    const id     = gerarId()
    const numero = 'ORC-' + Date.now().toString(36).toUpperCase()
    const qtd    = parseInt(String(quantidade)) || 1
    const freteNum = frete !== null && frete !== undefined && frete !== '' ? parseFloat(String(frete)) : 0
    // Total autoritativo no servidor: Σ itens (já com desconto de item) − desconto do orçamento + frete.
    const vlr = Array.isArray(itens) && itens.length > 0
      ? totalOrcamento(itens.map((it: any) => ({ quantidade: it.quantidade, valorUnitario: it.valorUnitario ?? it.valorItem, desconto: it.desconto, descontoTipo: it.descontoTipo })), freteNum, descVal, descTipo)
      : ((valor !== null && valor !== undefined && valor !== '' ? parseFloat(String(valor)) : 0) + freteNum) || null
    const dvDate = dataValidade      ? new Date(dataValidade + 'T12:00:00Z')      : null
    const deDate = dataEnvioEstimada ? new Date(dataEnvioEstimada + 'T12:00:00Z') : null
    const extras = camposExtras
      ? (typeof camposExtras === 'string' ? camposExtras : JSON.stringify(camposExtras))
      : null
    const politicas = politicasEmpresa || null

    await prisma.$executeRaw`
      INSERT INTO "Orcamento" (
        "id","workspaceId","numero","titulo","clienteId","clienteNome","clienteEmail","clienteWhatsapp",
        "canal","produto","quantidade","valor","frete","descontoValor","descontoTipo","dataValidade","dataEnvioEstimada",
        "observacoes","status","camposExtras","politicasEmpresa"
      ) VALUES (
        ${id},${workspaceId},${numero},${tituloVal},${clienteIdVal},${clienteNome},${clienteEmail ?? null},${clienteWhatsapp ?? null},
        ${canal ?? null},${produto},${qtd},${vlr},${freteNum},${descVal},${descTipo},${dvDate},${deDate},
        ${observacoes ?? null},'RASCUNHO',${extras},${politicas}
      )
    `

    // Inserir itens na tabela OrcamentoItem
    if (Array.isArray(itens) && itens.length > 0) {
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

    const [novo] = await prisma.$queryRaw`
      SELECT "id","workspaceId","numero","titulo","clienteId","clienteNome","clienteEmail","clienteWhatsapp","canal","produto",
             "quantidade","valor",COALESCE("frete",0) AS "frete",
             COALESCE("descontoValor",0) AS "descontoValor",COALESCE("descontoTipo",'valor') AS "descontoTipo",
             "observacoes","status","pedidoId","camposExtras",
             "politicasEmpresa","tokenAprovacao","aprovadoEm",
             TO_CHAR("dataValidade",'YYYY-MM-DD') AS "dataValidade",
             TO_CHAR("dataEnvioEstimada",'YYYY-MM-DD') AS "dataEnvioEstimada"
      FROM "Orcamento" WHERE "id" = ${id}` as any[]
    const itensCriados = await prisma.$queryRaw`
      SELECT "id","orcamentoId","produto","quantidade","valorUnitario","isKit","qtdKitPecas","ordem","variacaoId",
             COALESCE("desconto",0) AS "desconto", COALESCE("descontoTipo",'valor') AS "descontoTipo"
      FROM "OrcamentoItem"
      WHERE "orcamentoId" = ${id}
      ORDER BY "ordem" ASC
    ` as any[]

    return NextResponse.json(serialize({ ...novo, itens: itensCriados }))
  } catch (error) {
    console.error('POST /api/orcamentos:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
