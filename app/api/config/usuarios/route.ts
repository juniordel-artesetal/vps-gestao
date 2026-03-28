import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// GET — lista usuários do workspace
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const workspaceId = session.user.workspaceId

    const usuarios = await prisma.$queryRaw`
      SELECT "id", "nome", "email", "role", "ativo", "createdAt"
      FROM "User"
      WHERE "workspaceId" = ${workspaceId}
      ORDER BY "createdAt" ASC
    ` as any[]

    return NextResponse.json({ usuarios })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — cria novo usuário
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { nome, email, senha, role } = await req.json()

    if (!nome || !email || !senha || !role) {
      return NextResponse.json({ error: 'Preencha todos os campos' }, { status: 400 })
    }

    if (senha.length < 6) {
      return NextResponse.json({ error: 'Senha deve ter mínimo 6 caracteres' }, { status: 400 })
    }

    if (!['ADMIN', 'DELEGADOR', 'OPERADOR'].includes(role)) {
      return NextResponse.json({ error: 'Perfil inválido' }, { status: 400 })
    }

    const workspaceId = session.user.workspaceId

    // Verifica email duplicado no workspace
    const existente = await prisma.$queryRaw`
      SELECT id FROM "User"
      WHERE "email" = ${email} AND "workspaceId" = ${workspaceId}
      LIMIT 1
    ` as any[]

    if (existente.length > 0) {
      return NextResponse.json({ error: 'Este email já está cadastrado' }, { status: 400 })
    }

    const id = gerarId()
    const hash = await bcrypt.hash(senha, 10)

    await prisma.$executeRaw`
      INSERT INTO "User" ("id", "workspaceId", "nome", "email", "senha", "role", "ativo")
      VALUES (${id}, ${workspaceId}, ${nome}, ${email}, ${hash}, ${role}, true)
    `

    const novos = await prisma.$queryRaw`
      SELECT "id", "nome", "email", "role", "ativo", "createdAt"
      FROM "User" WHERE "id" = ${id}
    ` as any[]

    return NextResponse.json({ usuario: novos[0] })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
