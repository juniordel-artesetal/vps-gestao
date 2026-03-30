import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — retorna todos os campos marcados como "usar como filtro"
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const workspaceId = session.user.workspaceId

    const campos = await prisma.$queryRaw`
      SELECT sc.*, s."nome" as "setorNome"
      FROM "SetorCampo" sc
      JOIN "SetorConfig" s ON s."id" = sc."setorId"
      WHERE sc."workspaceId" = ${workspaceId}
      AND sc."usarComoFiltro" = true
      AND sc."ativo" = true
      ORDER BY s."ordem" ASC, sc."ordem" ASC
    ` as any[]

    return NextResponse.json({ campos })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
