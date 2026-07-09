import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDemandaTables } from './_lib/schema'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    await ensureDemandaTables()
    const workspaceId = session.user.workspaceId
    const { searchParams } = new URL(req.url)
    const status       = searchParams.get('status')
    const freelancerId = searchParams.get('freelancerId')
    const pedidoId     = searchParams.get('pedidoId')
    const de           = searchParams.get('de')
    const ate          = searchParams.get('ate')

    const rows = await prisma.$queryRaw`
      SELECT
        d."id",
        d."pedidoId",
        COALESCE('#' || o."numero", d."pedidoId") AS "pedidoRef",
        d."freelancerId", f."nome" AS "freelancerNome",
        d."nomeProduto",
        d."qtdSolicitada"::int, d."qtdProduzida"::int,
        d."valorPorItem", d."valorTotal", d."status",
        d."observacoes", d."dataPagamento",
        d."lancamentoId", d."categoriaId",
        d."createdAt", d."updatedAt",
        (SELECT COUNT(*) FROM "DemandaItem" i WHERE i."demandaId" = d."id")::int AS "nItens",
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', i."id", 'produto', i."produto", 'qtd', i."qtd",
            'valorUnit', i."valorUnit", 'subtotal', i."subtotal"
          ) ORDER BY i."produto")
          FROM "DemandaItem" i WHERE i."demandaId" = d."id"
        ), '[]'::json) AS "itens"
      FROM "Demanda" d
      INNER JOIN "Freelancer" f ON f."id" = d."freelancerId"
      LEFT JOIN "Order" o ON o."id" = d."pedidoId"
      WHERE d."workspaceId" = ${workspaceId}
      ORDER BY d."createdAt" DESC
    ` as any[]

    let resultado = serialize(rows)
    if (status)       resultado = resultado.filter((d: any) => d.status === status)
    if (freelancerId) resultado = resultado.filter((d: any) => d.freelancerId === freelancerId)
    if (pedidoId)     resultado = resultado.filter((d: any) => d.pedidoId === pedidoId)
    if (de)           resultado = resultado.filter((d: any) => d.createdAt >= de)
    if (ate)          resultado = resultado.filter((d: any) => d.createdAt <= ate + 'T23:59:59')

    return NextResponse.json(resultado)
  } catch (error) {
    console.error('[GET demandas]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    await ensureDemandaTables()

    const workspaceId = session.user.workspaceId
    const body = await req.json()
    const { freelancerId, nomeProduto, qtdSolicitada, valorPorItem, pedidoId, observacoes, itens } = body

    if (!freelancerId)
      return NextResponse.json({ error: 'Freelancer é obrigatório' }, { status: 400 })

    const freCheck = await prisma.$queryRaw`
      SELECT "id" FROM "Freelancer"
      WHERE "id" = ${freelancerId} AND "workspaceId" = ${workspaceId} LIMIT 1
    ` as any[]
    if (freCheck.length === 0)
      return NextResponse.json({ error: 'Freelancer não encontrada' }, { status: 404 })

    const id = gerarId()

    // ── Caminho NOVO: vários itens no mesmo trabalho ────────────────────────────
    // A demanda vira o "cabeçalho" e cada item vai para DemandaItem. O total do
    // trabalho (valorTotal) já é gravado como a soma dos subtotais.
    const itensNorm = Array.isArray(itens)
      ? itens
          .map((it: any) => ({
            produto: String(it.produto || '').trim(),
            qtd: parseInt(String(it.qtd)) || 0,
            valorUnit: parseFloat(String(it.valorUnit)) || 0,
          }))
          .filter((it: any) => it.produto && it.qtd > 0)
      : []

    if (itensNorm.length > 0) {
      const totalQtd = itensNorm.reduce((s: number, i: any) => s + i.qtd, 0)
      const totalVal = itensNorm.reduce((s: number, i: any) => s + i.qtd * i.valorUnit, 0)
      const vpi      = itensNorm.length === 1 ? itensNorm[0].valorUnit : 0
      const resumo   = itensNorm.length === 1
        ? `${itensNorm[0].produto}${itensNorm[0].qtd > 1 ? ` (${itensNorm[0].qtd}x)` : ''}`
        : itensNorm.map((i: any) => `${i.produto} (${i.qtd}x)`).join(' + ')

      await prisma.$executeRaw`
        INSERT INTO "Demanda"
          ("id","workspaceId","pedidoId","freelancerId","nomeProduto",
           "qtdSolicitada","qtdProduzida","valorPorItem","valorTotal","status","observacoes")
        VALUES
          (${id}, ${workspaceId}, ${pedidoId || null}, ${freelancerId},
           ${resumo}, ${totalQtd}, 0, ${vpi}, ${totalVal}, 'PENDENTE', ${observacoes || null})
      `
      for (const it of itensNorm) {
        await prisma.$executeRaw`
          INSERT INTO "DemandaItem"
            ("id","demandaId","workspaceId","produto","qtd","valorUnit","subtotal")
          VALUES
            (${gerarId()}, ${id}, ${workspaceId}, ${it.produto}, ${it.qtd}, ${it.valorUnit}, ${it.qtd * it.valorUnit})
        `
      }
      return NextResponse.json({ ok: true, id })
    }

    // ── Caminho LEGADO: trabalho de um único produto (mantém a criação pelo pedido) ─
    if (!qtdSolicitada)
      return NextResponse.json({ error: 'Freelancer e quantidade são obrigatórios' }, { status: 400 })

    const qtd   = parseInt(String(qtdSolicitada)) || 1
    const valor = parseFloat(String(valorPorItem)) || 0
    const desc  = nomeProduto || 'Produção'

    await prisma.$executeRaw`
      INSERT INTO "Demanda"
        ("id","workspaceId","pedidoId","freelancerId","nomeProduto",
         "qtdSolicitada","qtdProduzida","valorPorItem","valorTotal","status","observacoes")
      VALUES
        (${id}, ${workspaceId}, ${pedidoId || null}, ${freelancerId},
         ${desc}, ${qtd}, 0, ${valor}, 0, 'PENDENTE', ${observacoes || null})
    `
    return NextResponse.json({ ok: true, id })
  } catch (error) {
    console.error('[POST demandas]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
