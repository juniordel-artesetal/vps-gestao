import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId

  const rows = await prisma.$queryRaw`
    SELECT "moduloEstoque" FROM "Workspace"
    WHERE "id" = ${workspaceId} LIMIT 1
  ` as any[]

  return NextResponse.json({ moduloEstoque: rows[0]?.moduloEstoque ?? false })
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { moduloEstoque } = await req.json()
  const val = Boolean(moduloEstoque)

  await prisma.$executeRaw`
    UPDATE "Workspace"
    SET "moduloEstoque" = ${val}
    WHERE "id" = ${workspaceId}
  `

  return NextResponse.json({ moduloEstoque: val })
}