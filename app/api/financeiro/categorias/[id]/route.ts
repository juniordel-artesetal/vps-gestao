// app/api/financeiro/categorias/[id]/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { id } = await params
  const { nome, tipo, cor, icone } = await req.json()
  if (!nome || !tipo) return NextResponse.json({ error: 'nome e tipo são obrigatórios' }, { status: 400 })

  await prisma.$executeRaw`
    UPDATE "FinCategoria"
    SET nome=${nome}, tipo=${tipo}, cor=${cor ?? '#f97316'}, icone=${icone ?? '📁'}
    WHERE id=${id} AND "workspaceId"=${workspaceId}
  `

  const [row] = await prisma.$queryRaw`
    SELECT * FROM "FinCategoria" WHERE id=${id}
  ` as any[]

  return NextResponse.json(row)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { id } = await params

  // Verifica se há lançamentos usando esta categoria
  const [uso] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS total FROM "FinLancamento"
    WHERE "categoriaId"=${id} AND "workspaceId"=${workspaceId}
  ` as any[]

  if (uso?.total > 0)
    return NextResponse.json(
      { error: `Não é possível excluir: ${uso.total} lançamento(s) usa(m) esta categoria.` },
      { status: 409 }
    )

  await prisma.$executeRaw`
    DELETE FROM "FinCategoria" WHERE id=${id} AND "workspaceId"=${workspaceId}
  `

  return NextResponse.json({ ok: true })
}
