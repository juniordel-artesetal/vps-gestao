import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

async function verificarMaster() {
  const cookieStore = await cookies()
  return cookieStore.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// ── GET — lista usuários do workspace
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params

  const usuarios = await prisma.$queryRaw`
    SELECT id, nome, email, role, ativo, "createdAt"
    FROM "User"
    WHERE "workspaceId" = ${id}
    ORDER BY "createdAt" ASC
  ` as any[]

  return NextResponse.json(serialize({ usuarios }))
}

// ── PUT — editar workspace (nome, plano, ativo)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id }  = await params
  const { nome, plano, ativo } = await req.json()

  if (nome !== undefined) {
    await prisma.$executeRaw`UPDATE "Workspace" SET "nome" = ${nome} WHERE "id" = ${id}`
  }
  if (plano !== undefined) {
    await prisma.$executeRaw`UPDATE "Workspace" SET "plano" = ${plano} WHERE "id" = ${id}`
  }
  if (ativo !== undefined) {
    await prisma.$executeRaw`UPDATE "Workspace" SET "ativo" = ${ativo} WHERE "id" = ${id}`
  }

  return NextResponse.json({ ok: true })
}

// ── DELETE — excluir workspace e todos os dados
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params

  // Deleta em cascata na ordem correta
  await prisma.$executeRaw`DELETE FROM "AiConversa"           WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "AiUsageLog"           WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "SuporteChamado"       WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "Notificacao"          WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "FinMeta"              WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "FinLancamento"        WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "FinCategoria"         WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "PrecConfigTributaria" WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "PrecCombo"            WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "PrecProduto"          WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "PrecMaterial"         WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "PrecEmbalagem"        WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "HotmartEvent"         WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "WorkItem"             WHERE "orderId" IN (SELECT id FROM "Order" WHERE "workspaceId" = ${id})`
  await prisma.$executeRaw`DELETE FROM "Order"                WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "Setor"                WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "User"                 WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "Workspace"            WHERE "id"          = ${id}`

  return NextResponse.json({ ok: true })
}
