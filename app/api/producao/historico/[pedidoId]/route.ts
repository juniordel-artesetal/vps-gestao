import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// GET — busca histórico do pedido
export async function GET(req: NextRequest, { params }: { params: Promise<{ pedidoId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { pedidoId } = await params
    const workspaceId = session.user.workspaceId

    const historico = await prisma.$queryRaw`
      SELECT *
      FROM "PedidoHistorico"
      WHERE "pedidoId" = ${pedidoId}
      AND "workspaceId" = ${workspaceId}
      ORDER BY "createdAt" DESC
    ` as any[]

    return NextResponse.json({ historico })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — adiciona entrada manual no histórico
export async function POST(req: NextRequest, { params }: { params: Promise<{ pedidoId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { pedidoId } = await params
    const { descricao, tipo } = await req.json()
    const workspaceId = session.user.workspaceId

    if (!descricao) return NextResponse.json({ error: 'Descrição obrigatória' }, { status: 400 })

    const id = gerarId()

    await prisma.$executeRaw`
      INSERT INTO "PedidoHistorico" ("id", "pedidoId", "workspaceId", "tipo", "descricao", "usuarioNome")
      VALUES (${id}, ${pedidoId}, ${workspaceId}, ${tipo || 'OBSERVACAO'}, ${descricao}, ${session.user.name})
    `

    const novos = await prisma.$queryRaw`
      SELECT * FROM "PedidoHistorico" WHERE "id" = ${id}
    ` as any[]

    return NextResponse.json({ historico: novos[0] })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
