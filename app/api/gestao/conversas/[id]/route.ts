// app/api/gestao/conversas/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — carrega uma conversa com mensagens
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { id } = await params

  const [row] = await prisma.$queryRaw`
    SELECT * FROM "AiConversa"
    WHERE id = ${id} AND "workspaceId" = ${workspaceId}
  ` as any[]

  if (!row) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

  return NextResponse.json({
    ...row,
    mensagens: JSON.parse(row.mensagens || '[]'),
  })
}

// PUT — atualiza título e/ou mensagens
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { id } = await params
  const { titulo, mensagens } = await req.json()

  const mensagensJson = JSON.stringify(mensagens || [])

  await prisma.$executeRaw`
    UPDATE "AiConversa"
    SET titulo = COALESCE(${titulo || null}, titulo),
        mensagens = ${mensagensJson},
        "updatedAt" = NOW()
    WHERE id = ${id} AND "workspaceId" = ${workspaceId}
  `

  return NextResponse.json({ ok: true })
}

// DELETE — remove conversa
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { id } = await params

  await prisma.$executeRaw`
    DELETE FROM "AiConversa" WHERE id = ${id} AND "workspaceId" = ${workspaceId}
  `

  return NextResponse.json({ ok: true })
}
