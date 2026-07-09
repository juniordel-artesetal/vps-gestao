import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDemandaTables } from '../_lib/schema'

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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    await ensureDemandaTables()
    const { id } = await params
    const workspaceId = session.user.workspaceId

    const rows = await prisma.$queryRaw`
      SELECT
        d."id", d."pedidoId", d."freelancerId", d."nomeProduto",
        d."qtdSolicitada"::int, d."qtdProduzida"::int,
        d."valorPorItem", d."valorTotal", d."status", d."observacoes",
        d."dataPagamento", d."createdAt"
      FROM "Demanda" d
      WHERE d."id" = ${id} AND d."workspaceId" = ${workspaceId} LIMIT 1
    ` as any[]
    if (rows.length === 0) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    const itens = await prisma.$queryRaw`
      SELECT "id", "produto", "qtd"::int, "valorUnit", "subtotal"
      FROM "DemandaItem" WHERE "demandaId" = ${id} AND "workspaceId" = ${workspaceId}
      ORDER BY "produto" ASC
    ` as any[]

    return NextResponse.json(serialize({ ...rows[0], itens }))
  } catch (error) {
    console.error('[GET demandas/id]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  await ensureDemandaTables()

  const { id } = await params
  const workspaceId = session.user.workspaceId
  const body = await req.json()

  const check = await prisma.$queryRaw`
    SELECT "id", "qtdSolicitada", "valorPorItem", "freelancerId",
      (SELECT COUNT(*) FROM "DemandaItem" i WHERE i."demandaId" = "Demanda"."id")::int AS "nItens"
    FROM "Demanda" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId} LIMIT 1
  ` as any[]
  if (check.length === 0) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const demanda = check[0]
  const temItens = Number(demanda.nItens) > 0

  // ── Pagamento: cria lançamento no financeiro ──────────────────────────────
  if (body.status === 'PAGO' && body.criarLancamento) {
    const { categoriaId, valorPago } = body

    const fre = await prisma.$queryRaw`
      SELECT nome FROM "Freelancer" WHERE id = ${demanda.freelancerId} LIMIT 1
    ` as any[]
    const nomeFreelancer = fre[0]?.nome || 'Freelancer'

    const valor = parseFloat(String(valorPago || demanda.valorPorItem)) || 0
    const lancId = gerarId()

    await prisma.$executeRaw`
      INSERT INTO "FinLancamento"
        ("id","workspaceId","tipo","categoriaId","descricao","valor","data","referencia","createdAt")
      VALUES
        (${lancId}, ${workspaceId}, 'DESPESA', ${categoriaId || null},
         ${'Pagamento freelancer: ' + nomeFreelancer},
         ${valor}, NOW()::date, ${'demanda:' + id}, NOW())
    `

    await prisma.$executeRaw`
      UPDATE "Demanda" SET
        "status"        = 'PAGO',
        "dataPagamento" = NOW(),
        "lancamentoId"  = ${lancId},
        "categoriaId"   = ${categoriaId || null},
        "updatedAt"     = NOW()
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `
    return NextResponse.json({ ok: true, lancamentoId: lancId })
  }

  // ── Status simples (sem pagamento) ────────────────────────────────────────
  if (body.status !== undefined && body.status !== 'PAGO') {
    await prisma.$executeRaw`
      UPDATE "Demanda" SET
        "status"    = ${body.status},
        "updatedAt" = NOW()
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `
  }

  // ── Qtd produzida ─────────────────────────────────────────────────────────
  // Em trabalhos com vários itens (nItens > 0) o valorTotal já é o acordado e NÃO
  // deve ser recalculado por qtd produzida (evita zerar o total). Só recalcula no legado.
  if (body.qtdProduzida !== undefined) {
    const qtdP  = parseInt(String(body.qtdProduzida)) || 0
    if (temItens) {
      await prisma.$executeRaw`
        UPDATE "Demanda" SET "qtdProduzida" = ${qtdP}, "updatedAt" = NOW()
        WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
      `
    } else {
      const vlrP  = parseFloat(String(body.valorPorItem ?? demanda.valorPorItem)) || 0
      const total = qtdP * vlrP
      await prisma.$executeRaw`
        UPDATE "Demanda" SET
          "qtdProduzida" = ${qtdP},
          "valorTotal"   = ${total},
          "updatedAt"    = NOW()
        WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
      `
    }
  }

  // ── Edição geral ──────────────────────────────────────────────────────────
  const { freelancerId, nomeProduto, qtdSolicitada, valorPorItem, pedidoId, observacoes, itens } = body
  if (freelancerId  !== undefined) await prisma.$executeRaw`UPDATE "Demanda" SET "freelancerId"  = ${freelancerId},           "updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  if (pedidoId      !== undefined) await prisma.$executeRaw`UPDATE "Demanda" SET "pedidoId"      = ${pedidoId || null},        "updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  if (observacoes   !== undefined) await prisma.$executeRaw`UPDATE "Demanda" SET "observacoes"   = ${observacoes || null},     "updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`

  // ── Itens (vários produtos): substitui a lista e recalcula o cabeçalho ──────
  if (Array.isArray(itens)) {
    const norm = itens
      .map((it: any) => ({
        produto: String(it.produto || '').trim(),
        qtd: parseInt(String(it.qtd)) || 0,
        valorUnit: parseFloat(String(it.valorUnit)) || 0,
      }))
      .filter((it: any) => it.produto && it.qtd > 0)

    await prisma.$executeRaw`DELETE FROM "DemandaItem" WHERE "demandaId" = ${id} AND "workspaceId" = ${workspaceId}`
    if (norm.length > 0) {
      for (const it of norm) {
        await prisma.$executeRaw`
          INSERT INTO "DemandaItem" ("id","demandaId","workspaceId","produto","qtd","valorUnit","subtotal")
          VALUES (${gerarId()}, ${id}, ${workspaceId}, ${it.produto}, ${it.qtd}, ${it.valorUnit}, ${it.qtd * it.valorUnit})
        `
      }
      const totalQtd = norm.reduce((s, i) => s + i.qtd, 0)
      const totalVal = norm.reduce((s, i) => s + i.qtd * i.valorUnit, 0)
      const vpi      = norm.length === 1 ? norm[0].valorUnit : 0
      const resumo   = norm.length === 1
        ? `${norm[0].produto}${norm[0].qtd > 1 ? ` (${norm[0].qtd}x)` : ''}`
        : norm.map(i => `${i.produto} (${i.qtd}x)`).join(' + ')
      await prisma.$executeRaw`
        UPDATE "Demanda" SET
          "nomeProduto"   = ${resumo},
          "qtdSolicitada" = ${totalQtd},
          "valorPorItem"  = ${vpi},
          "valorTotal"    = ${totalVal},
          "updatedAt"     = NOW()
        WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
      `
    }
  } else {
    // Sem itens no payload: mantém a edição por campo único (legado / criação pelo pedido)
    if (nomeProduto   !== undefined) await prisma.$executeRaw`UPDATE "Demanda" SET "nomeProduto"   = ${nomeProduto || null},     "updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (qtdSolicitada !== undefined) await prisma.$executeRaw`UPDATE "Demanda" SET "qtdSolicitada" = ${parseInt(qtdSolicitada)},"updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (valorPorItem  !== undefined) await prisma.$executeRaw`UPDATE "Demanda" SET "valorPorItem"  = ${parseFloat(valorPorItem) || 0}, "updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  await ensureDemandaTables()
  const { id } = await params
  const workspaceId = session.user.workspaceId
  await prisma.$executeRaw`DELETE FROM "DemandaItem" WHERE "demandaId" = ${id} AND "workspaceId" = ${workspaceId}`
  await prisma.$executeRaw`DELETE FROM "Demanda" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  return NextResponse.json({ ok: true })
}
