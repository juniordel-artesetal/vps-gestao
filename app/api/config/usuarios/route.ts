import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// ── GET — lista usuários do workspace
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const workspaceId = session.user.workspaceId

  const usuarios = await prisma.$queryRaw`
    SELECT
      id, nome, email, role, ativo,
      "createdAt"
    FROM "User"
    WHERE "workspaceId" = ${workspaceId}
    ORDER BY "createdAt" ASC
  ` as any[]

  return NextResponse.json({ usuarios })
}

// ── POST — criar novo usuário no workspace
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const workspaceId = session.user.workspaceId
  const { nome, email, senha, role } = await req.json()

  // Validações básicas
  if (!nome?.trim() || !email?.trim() || !senha || !role) {
    return NextResponse.json({ error: 'Preencha todos os campos' }, { status: 400 })
  }
  if (senha.length < 6) {
    return NextResponse.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, { status: 400 })
  }
  if (!['ADMIN', 'DELEGADOR', 'OPERADOR'].includes(role)) {
    return NextResponse.json({ error: 'Perfil inválido' }, { status: 400 })
  }

  // Verificar se email já existe (em qualquer workspace)
  const existente = await prisma.$queryRaw`
    SELECT id FROM "User" WHERE LOWER("email") = LOWER(${email.trim()}) LIMIT 1
  ` as any[]

  if (existente.length > 0) {
    return NextResponse.json({ error: 'Este e-mail já está em uso' }, { status: 409 })
  }

  // Hash da senha
  const senhaHash = await bcrypt.hash(senha, 10)

  // Criar usuário
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36)

  await prisma.$executeRaw`
    INSERT INTO "User" ("id", "nome", "email", "senha", "role", "workspaceId", "ativo", "createdAt")
    VALUES (
      ${id},
      ${nome.trim()},
      ${email.trim().toLowerCase()},
      ${senhaHash},
      ${role},
      ${workspaceId},
      true,
      NOW()
    )
  `

  const usuario = {
    id,
    nome: nome.trim(),
    email: email.trim().toLowerCase(),
    role,
    ativo: true,
    createdAt: new Date().toISOString(),
  }

  return NextResponse.json({ usuario }, { status: 201 })
}
