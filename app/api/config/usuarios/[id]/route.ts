import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// PUT — atualiza role, ativo ou senha
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    const workspaceId = session.user.workspaceId

    // Verifica se pertence ao workspace
    const usuarios = await prisma.$queryRaw`
      SELECT id FROM "User"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!usuarios.length) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // Não deixa alterar o próprio usuário logado via API
    if (id === session.user.id && (body.role || body.ativo === false)) {
      return NextResponse.json({ error: 'Não é possível alterar sua própria conta' }, { status: 400 })
    }

    if (body.role !== undefined) {
      if (!['ADMIN', 'DELEGADOR', 'OPERADOR'].includes(body.role)) {
        return NextResponse.json({ error: 'Perfil inválido' }, { status: 400 })
      }
      await prisma.$executeRaw`
        UPDATE "User" SET "role" = ${body.role} WHERE "id" = ${id}
      `
    }

    if (body.ativo !== undefined) {
      await prisma.$executeRaw`
        UPDATE "User" SET "ativo" = ${body.ativo} WHERE "id" = ${id}
      `
    }

    if (body.senha) {
      if (body.senha.length < 6) {
        return NextResponse.json({ error: 'Senha deve ter mínimo 6 caracteres' }, { status: 400 })
      }
      const hash = await bcrypt.hash(body.senha, 10)
      await prisma.$executeRaw`
        UPDATE "User" SET "senha" = ${hash} WHERE "id" = ${id}
      `
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
