import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

// PUT — editar usuária (role, ativo, senha)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    // Garantir que a usuária pertence ao workspace
    const existe = await prisma.$queryRaw`
      SELECT id FROM "User"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
      LIMIT 1
    ` as any[]

    if (existe.length === 0) {
      return NextResponse.json({ error: 'Usuária não encontrada' }, { status: 404 })
    }

    // Não permitir que o ADMIN edite a si mesmo (para não perder acesso)
    if (id === session.user.id) {
      return NextResponse.json({ error: 'Você não pode editar sua própria conta aqui' }, { status: 400 })
    }

    const body = await req.json()
    const { nome, role, ativo, senha } = body

    if (nome !== undefined) {
      await prisma.$executeRaw`
        UPDATE "User" SET "nome" = ${nome} WHERE "id" = ${id}
      `
    }
    if (role !== undefined) {
      await prisma.$executeRaw`
        UPDATE "User" SET "role" = ${role} WHERE "id" = ${id}
      `
    }
    if (ativo !== undefined) {
      await prisma.$executeRaw`
        UPDATE "User" SET "ativo" = ${ativo} WHERE "id" = ${id}
      `
    }
    if (senha && senha.trim().length >= 6) {
      const senhaHash = await bcrypt.hash(senha, 10)
      await prisma.$executeRaw`
        UPDATE "User" SET "senha" = ${senhaHash}, "primeiroLogin" = true WHERE "id" = ${id}
      `
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PUT /api/config/usuarios/[id]]', err)
    return NextResponse.json({ error: 'Erro ao atualizar usuária' }, { status: 500 })
  }
}

// DELETE — remover usuária do workspace
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    if (id === session.user.id) {
      return NextResponse.json({ error: 'Você não pode remover sua própria conta' }, { status: 400 })
    }

    await prisma.$executeRaw`
      DELETE FROM "User"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/config/usuarios/[id]]', err)
    return NextResponse.json({ error: 'Erro ao remover usuária' }, { status: 500 })
  }
}
