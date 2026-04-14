import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (typeof obj === 'object' && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') {
    const r: any = {}
    for (const k of Object.keys(obj)) r[k] = serialize(obj[k])
    return r
  }
  return obj
}

async function verificarMaster(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// POST — criar workspace manualmente (sem Hotmart)
export async function POST(req: NextRequest) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await req.json()
    const { nome, email, senha, plano } = body

    if (!nome || !email || !senha)
      return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 })

    // Verificar se e-mail já existe
    const [existente] = await prisma.$queryRaw`
      SELECT id FROM "User" WHERE "email" = ${email.toLowerCase().trim()}
    ` as any[]
    if (existente)
      return NextResponse.json({ error: 'Já existe um usuário com este e-mail' }, { status: 409 })

    const workspaceId = gerarId()
    const userId      = gerarId()
    const slug        = nome.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      + '-' + Math.random().toString(36).slice(2, 6)
    const senhaHash   = await bcrypt.hash(senha, 10)
    const planoFinal  = plano || 'TRIAL'

    // Criar workspace
    await prisma.$executeRaw`
      INSERT INTO "Workspace" (
        "id","nome","slug","plano","ativo","createdAt","updatedAt"
      ) VALUES (
        ${workspaceId},${nome.trim()},${slug},${planoFinal},true,NOW(),NOW()
      )
    `

    // Criar usuário admin com primeiroLogin = true
    await prisma.$executeRaw`
      INSERT INTO "User" (
        "id","workspaceId","nome","email","senha","role","ativo","primeiroLogin","createdAt"
      ) VALUES (
        ${userId},${workspaceId},${nome.trim()},${email.toLowerCase().trim()},${senhaHash},'ADMIN',true,true,NOW()
      )
    `

    const [ws] = await prisma.$queryRaw`
      SELECT id, nome, slug, plano, ativo FROM "Workspace" WHERE "id" = ${workspaceId}
    ` as any[]

    return NextResponse.json(serialize({ ...ws, userId, email: email.toLowerCase().trim() }))
  } catch (error) {
    console.error('POST master/workspaces:', error)
    return NextResponse.json({ error: 'Erro interno ao criar workspace' }, { status: 500 })
  }
}
