import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// Serializa BigInt, Decimal e Date corretamente
function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

async function verificarMaster() {
  const cookieStore = await cookies()
  return cookieStore.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// ── GET — detalhes completos do workspace + usuários + histórico de login
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params

  // Workspace completo
  const workspaces = await prisma.$queryRaw`
    SELECT * FROM "Workspace" WHERE "id" = ${id} LIMIT 1
  ` as unknown as any[]

  // Usuários
  const usuarios = await prisma.$queryRaw`
    SELECT id, nome, email, role, ativo, "primeiroLogin", "createdAt"
    FROM "User"
    WHERE "workspaceId" = ${id}
    ORDER BY "createdAt" ASC
  ` as unknown as any[]

  // Histórico de login (últimos 20)
  const loginHistory = await prisma.$queryRaw`
    SELECT lh.id, lh.email, lh."sucesso", lh.ip, lh."createdAt",
           u.nome AS "usuarioNome"
    FROM "LoginHistory" lh
    LEFT JOIN "User" u ON u.id = lh."userId"
    WHERE lh."workspaceId" = ${id}
    ORDER BY lh."createdAt" DESC
    LIMIT 20
  ` as unknown as any[]

  return NextResponse.json(serialize({
    workspace: workspaces[0] ?? null,
    usuarios,
    loginHistory,
  }))
}

// ── PUT — editar workspace
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params
  const { nome, plano, ativo } = await req.json()

  if (nome  !== undefined) await prisma.$executeRaw`UPDATE "Workspace" SET "nome"  = ${nome}  WHERE "id" = ${id}`
  if (plano !== undefined) await prisma.$executeRaw`UPDATE "Workspace" SET "plano" = ${plano} WHERE "id" = ${id}`
  if (ativo !== undefined) await prisma.$executeRaw`UPDATE "Workspace" SET "ativo" = ${ativo} WHERE "id" = ${id}`

  return NextResponse.json({ ok: true })
}

// ── DELETE — excluir workspace em cascata
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params

  await prisma.$executeRaw`DELETE FROM "LoginHistory"         WHERE "workspaceId" = ${id}`
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
  await prisma.$executeRaw`DELETE FROM "WorkItem" WHERE "orderId" IN (SELECT id FROM "Order" WHERE "workspaceId" = ${id})`
  await prisma.$executeRaw`DELETE FROM "Order"                WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "Setor"                WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "User"                 WHERE "workspaceId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "Workspace"            WHERE "id"          = ${id}`

  return NextResponse.json({ ok: true })
}

// ── PATCH — resetar senha de usuário específico
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { userId, novaSenha, role, ativo } = await req.json()

  if (novaSenha) {
    const hash = await bcrypt.hash(novaSenha, 10)
    await prisma.$executeRaw`UPDATE "User" SET "senha" = ${hash}, "primeiroLogin" = true WHERE "id" = ${userId}`
  }
  if (role  !== undefined) await prisma.$executeRaw`UPDATE "User" SET "role"  = ${role}  WHERE "id" = ${userId}`
  if (ativo !== undefined) await prisma.$executeRaw`UPDATE "User" SET "ativo" = ${ativo} WHERE "id" = ${userId}`

  return NextResponse.json({ ok: true })
}
