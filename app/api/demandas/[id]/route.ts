import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId
  const body = await req.json()

  const check = await prisma.$queryRaw`
    SELECT "id", "qtdSolicitada", "valorPorItem", "freelancerId"
    FROM "Demanda" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId} LIMIT 1
  ` as any[]
  if (check.length === 0) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const demanda = check[0]

  // ── Pagamento: cria lançamento no financeiro ──────────────────────────────
  if (body.status === 'PAGO' && body.criarLancamento) {
    const { categoriaId, valorPago } = body

    // Busca nome da freelancer para descrição do lançamento
    const fre = await prisma.$queryRaw`
      SELECT nome FROM "Freelancer" WHERE id = ${demanda.freelancerId} LIMIT 1
    ` as any[]
    const nomeFreelancer = fre[0]?.nome || 'Freelancer'

    const valor = parseFloat(String(valorPago || demanda.valorPorItem)) || 0
    const lancId = Math.random().toString(36).slice(2) + Date.now().toString(36)

    // Cria lançamento de despesa no módulo financeiro
    await prisma.$executeRaw`
      INSERT INTO "FinLancamento"
        ("id","workspaceId","tipo","categoriaId","descricao","valor","data","referencia","createdAt")
      VALUES
        (${lancId}, ${workspaceId}, 'DESPESA', ${categoriaId || null},
         ${'Pagamento freelancer: ' + nomeFreelancer},
         ${valor}, NOW()::date, ${'demanda:' + id}, NOW())
    `

    // Atualiza demanda com pagamento
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
  if (body.qtdProduzida !== undefined) {
    const qtdP  = parseInt(String(body.qtdProduzida)) || 0
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

  // ── Edição geral ──────────────────────────────────────────────────────────
  const { freelancerId, nomeProduto, qtdSolicitada, valorPorItem, pedidoId, observacoes } = body
  if (freelancerId  !== undefined) await prisma.$executeRaw`UPDATE "Demanda" SET "freelancerId"  = ${freelancerId},           "updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  if (nomeProduto   !== undefined) await prisma.$executeRaw`UPDATE "Demanda" SET "nomeProduto"   = ${nomeProduto || null},     "updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  if (qtdSolicitada !== undefined) await prisma.$executeRaw`UPDATE "Demanda" SET "qtdSolicitada" = ${parseInt(qtdSolicitada)},"updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  if (valorPorItem  !== undefined) await prisma.$executeRaw`UPDATE "Demanda" SET "valorPorItem"  = ${parseFloat(valorPorItem) || 0}, "updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  if (pedidoId      !== undefined) await prisma.$executeRaw`UPDATE "Demanda" SET "pedidoId"      = ${pedidoId || null},        "updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  if (observacoes   !== undefined) await prisma.$executeRaw`UPDATE "Demanda" SET "observacoes"   = ${observacoes || null},     "updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { id } = await params
  const workspaceId = session.user.workspaceId
  await prisma.$executeRaw`DELETE FROM "Demanda" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  return NextResponse.json({ ok: true })
}
