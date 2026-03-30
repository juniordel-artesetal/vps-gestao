import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ setores: [] })

    const workspaceId = session.user.workspaceId

    const setores = await prisma.$queryRaw`
      SELECT "id", "nome", "ordem"
      FROM "SetorConfig"
      WHERE "workspaceId" = ${workspaceId}
      AND "ativo" = true
      ORDER BY "ordem" ASC
    ` as any[]

    return NextResponse.json({ setores })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ setores: [] })
  }
}
