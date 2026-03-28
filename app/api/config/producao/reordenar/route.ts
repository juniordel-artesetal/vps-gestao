import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST — salva nova ordem dos setores
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { setores } = await req.json()
    const workspaceId = session.user.workspaceId

    if (!Array.isArray(setores)) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
    }

    // Atualiza ordem de cada setor
    for (const setor of setores) {
      await prisma.$executeRaw`
        UPDATE "SetorConfig"
        SET "ordem" = ${setor.ordem}
        WHERE "id" = ${setor.id} AND "workspaceId" = ${workspaceId}
      `
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
