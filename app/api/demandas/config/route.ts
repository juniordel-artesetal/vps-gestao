import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const rows = await prisma.$queryRaw`
    SELECT "moduloDemandas" FROM "Workspace" WHERE "id" = ${session.user.workspaceId} LIMIT 1
  ` as any[]
  return NextResponse.json({ moduloDemandas: rows[0]?.moduloDemandas ?? false })
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { moduloDemandas } = await req.json()
  await prisma.$executeRaw`
    UPDATE "Workspace" SET "moduloDemandas" = ${Boolean(moduloDemandas)} WHERE "id" = ${session.user.workspaceId}
  `
  return NextResponse.json({ moduloDemandas: Boolean(moduloDemandas) })
}
