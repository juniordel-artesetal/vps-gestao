// Destino: app/api/config/usuarios/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Apenas administradores' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId

  try {
    // Verifica que o usuário pertence ao workspace
    const users = await prisma.$queryRaw`
      SELECT id, role FROM "User"
      WHERE id = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!users.length)
      return NextResponse.json({ error: 'Usuária não encontrada' }, { status: 404 })

    const body = await req.json()
    const { nome, role, ativo, novaSenha } = body

    // Validações
    if (role && !['ADMIN', 'DELEGADOR', 'OPERADOR'].includes(role))
      return NextResponse.json({ error: 'Role inválido' }, { status: 400 })

    // Não pode remover o último admin
    if (role && role !== 'ADMIN' && users[0].role === 'ADMIN') {
      const admins = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS cnt FROM "User"
        WHERE "workspaceId" = ${workspaceId} AND role = 'ADMIN' AND ativo = true
      ` as any[]
      if (Number(admins[0].cnt) <= 1)
        return NextResponse.json({ error: 'Não é possível remover o único administrador ativo' }, { status: 400 })
    }

    // Atualiza campos básicos
    if (nome || role !== undefined || ativo !== undefined) {
      await prisma.$executeRaw`
        UPDATE "User" SET
          "nome"  = COALESCE(${nome  ?? null}, "nome"),
          "role"  = COALESCE(${role  ?? null}, "role"),
          "ativo" = COALESCE(${ativo ?? null}, "ativo")
        WHERE id = ${id} AND "workspaceId" = ${workspaceId}
      `
    }

    // Atualiza senha se fornecida
    if (novaSenha) {
      if (novaSenha.length < 6)
        return NextResponse.json({ error: 'Senha mínima de 6 caracteres' }, { status: 400 })
      const hash = await bcrypt.hash(novaSenha, 10)
      await prisma.$executeRaw`
        UPDATE "User" SET
          "senha" = ${hash},
          "primeiroLogin" = true
        WHERE id = ${id} AND "workspaceId" = ${workspaceId}
      `
    }

    const rows = await prisma.$queryRaw`
      SELECT id, nome, email, role, ativo, "primeiroLogin", "createdAt"
      FROM "User" WHERE id = ${id}
    ` as any[]

    return NextResponse.json(serialize(rows[0]))
  } catch (err) {
    console.error('[PUT /api/config/usuarios/[id]]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Apenas administradores' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId

  // Não pode excluir a si mesma
  if (id === session.user.id)
    return NextResponse.json({ error: 'Você não pode excluir sua própria conta' }, { status: 400 })

  try {
    const users = await prisma.$queryRaw`
      SELECT id, role, ativo FROM "User"
      WHERE id = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!users.length)
      return NextResponse.json({ error: 'Usuária não encontrada' }, { status: 404 })

    // Não pode excluir o último admin ativo
    if (users[0].role === 'ADMIN' && users[0].ativo) {
      const admins = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS cnt FROM "User"
        WHERE "workspaceId" = ${workspaceId} AND role = 'ADMIN' AND ativo = true
      ` as any[]
      if (Number(admins[0].cnt) <= 1)
        return NextResponse.json({ error: 'Não é possível excluir o único administrador ativo' }, { status: 400 })
    }

    await prisma.$executeRaw`
      DELETE FROM "User" WHERE id = ${id} AND "workspaceId" = ${workspaceId}
    `

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/config/usuarios/[id]]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
