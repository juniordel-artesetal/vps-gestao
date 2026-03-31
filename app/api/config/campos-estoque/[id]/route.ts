import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PUT — edita campo (nome, tipo, opcoes, obrigatorio, ordem, ativo)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { id } = await params
  const body = await req.json()

  // Verifica que o campo pertence ao workspace
  const check = await prisma.$queryRaw`
    SELECT "id" FROM "EstCampoConfig"
    WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    LIMIT 1
  ` as any[]

  if (check.length === 0)
    return NextResponse.json({ error: 'Campo não encontrado' }, { status: 404 })

  // Atualiza apenas os campos enviados
  if (body.nome !== undefined) {
    await prisma.$executeRaw`
      UPDATE "EstCampoConfig" SET "nome" = ${body.nome.trim()}
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `
  }
  if (body.tipo !== undefined) {
    await prisma.$executeRaw`
      UPDATE "EstCampoConfig" SET "tipo" = ${body.tipo}
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `
  }
  if (body.opcoes !== undefined) {
    await prisma.$executeRaw`
      UPDATE "EstCampoConfig" SET "opcoes" = ${body.opcoes ?? null}
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `
  }
  if (body.obrigatorio !== undefined) {
    await prisma.$executeRaw`
      UPDATE "EstCampoConfig" SET "obrigatorio" = ${Boolean(body.obrigatorio)}
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `
  }
  if (body.ordem !== undefined) {
    await prisma.$executeRaw`
      UPDATE "EstCampoConfig" SET "ordem" = ${Number(body.ordem)}
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `
  }
  if (body.ativo !== undefined) {
    await prisma.$executeRaw`
      UPDATE "EstCampoConfig" SET "ativo" = ${Boolean(body.ativo)}
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `
  }

  return NextResponse.json({ ok: true })
}

// DELETE — remove campo e todos os valores associados (CASCADE)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { id } = await params

  // Verifica pertencimento
  const check = await prisma.$queryRaw`
    SELECT "id" FROM "EstCampoConfig"
    WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    LIMIT 1
  ` as any[]

  if (check.length === 0)
    return NextResponse.json({ error: 'Campo não encontrado' }, { status: 404 })

  // Deleta valores (por segurança, mesmo com CASCADE)
  await prisma.$executeRaw`
    DELETE FROM "EstCampoValor"
    WHERE "campoId" = ${id} AND "workspaceId" = ${workspaceId}
  `

  // Deleta campo
  await prisma.$executeRaw`
    DELETE FROM "EstCampoConfig"
    WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
  `

  return NextResponse.json({ ok: true })
}
