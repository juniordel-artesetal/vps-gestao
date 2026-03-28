import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function gerarSlug(nome: string, id: string) {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 30) + '-' + id.slice(0, 4)
}

export async function POST(req: NextRequest) {
  try {
    const { nome, email, senha, nomeNegocio } = await req.json()

    if (!nome || !email || !senha || !nomeNegocio) {
      return NextResponse.json({ error: 'Preencha todos os campos' }, { status: 400 })
    }

    if (senha.length < 6) {
      return NextResponse.json({ error: 'Senha deve ter mínimo 6 caracteres' }, { status: 400 })
    }

    // Verifica se email já existe
    const existente = await prisma.$queryRaw`
      SELECT id FROM "User" WHERE "email" = ${email} LIMIT 1
    ` as any[]

    if (existente.length > 0) {
      return NextResponse.json({ error: 'Este email já está cadastrado' }, { status: 400 })
    }

    const wsId = gerarId()
    const userId = gerarId()
    const themeId = gerarId()
    const slug = gerarSlug(nomeNegocio, wsId)
    const hash = await bcrypt.hash(senha, 10)

    // Cria workspace
    await prisma.$executeRaw`
      INSERT INTO "Workspace" ("id", "nome", "slug", "plano", "ativo", "assinaturaStatus")
      VALUES (${wsId}, ${nomeNegocio}, ${slug}, 'TRIAL', true, 'TRIAL')
    `

    // Cria usuário admin
    await prisma.$executeRaw`
      INSERT INTO "User" ("id", "workspaceId", "nome", "email", "senha", "role", "ativo")
      VALUES (${userId}, ${wsId}, ${nome}, ${email}, ${hash}, 'ADMIN', true)
    `

    // Cria tema padrão laranja
    await prisma.$executeRaw`
      INSERT INTO "WorkspaceTheme" ("id", "workspaceId", "modo", "corPrimaria", "presetNome")
      VALUES (${themeId}, ${wsId}, 'light', '#f97316', 'laranja')
    `

    return NextResponse.json({ ok: true, workspaceId: wsId })

  } catch (error) {
    console.error('Erro ao registrar:', error)
    return NextResponse.json({ error: 'Erro interno ao criar conta' }, { status: 500 })
  }
}