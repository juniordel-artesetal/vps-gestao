import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// POST — salva ou atualiza valor de campo do setor para um pedido
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { pedidoId, setorId, campoId, valor } = await req.json()
    if (!pedidoId || !campoId) return NextResponse.json({ error: 'Campos obrigatórios' }, { status: 400 })

    const workspaceId = session.user.workspaceId

    // Verifica se já existe
    const existente = await prisma.$queryRaw`
      SELECT id FROM "SetorCampoValor"
      WHERE "campoId" = ${campoId} AND "pedidoId" = ${pedidoId}
      LIMIT 1
    ` as any[]

    if (existente.length > 0) {
      await prisma.$executeRaw`
        UPDATE "SetorCampoValor"
        SET "valor" = ${valor}, "updatedAt" = NOW()
        WHERE "campoId" = ${campoId} AND "pedidoId" = ${pedidoId}
      `
    } else {
      const id = gerarId()
      await prisma.$executeRaw`
        INSERT INTO "SetorCampoValor" ("id", "campoId", "workspaceId", "pedidoId", "setorId", "valor")
        VALUES (${id}, ${campoId}, ${workspaceId}, ${pedidoId}, ${setorId}, ${valor})
      `
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// GET — busca valores dos campos de um pedido em um setor
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const pedidoId = searchParams.get('pedidoId')
    const setorId  = searchParams.get('setorId')

    if (!pedidoId || !setorId) return NextResponse.json({ error: 'pedidoId e setorId obrigatórios' }, { status: 400 })

    const valores = await prisma.$queryRaw`
      SELECT scv.*, sc."nome" as "campoNome"
      FROM "SetorCampoValor" scv
      JOIN "SetorCampo" sc ON sc."id" = scv."campoId"
      WHERE scv."pedidoId" = ${pedidoId}
        AND scv."setorId" = ${setorId}
    ` as any[]

    return NextResponse.json({ valores })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
