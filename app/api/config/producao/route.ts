import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// GET — lista setores do workspace
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const workspaceId = session.user.workspaceId

    const setores = await prisma.$queryRaw`
      SELECT * FROM "SetorConfig"
      WHERE "workspaceId" = ${workspaceId}
      ORDER BY "ordem" ASC, "createdAt" ASC
    ` as any[]

    return NextResponse.json({ setores })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — adiciona novo setor
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { nome } = await req.json()
    if (!nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

    const workspaceId = session.user.workspaceId

    // Pega a maior ordem atual
    const result = await prisma.$queryRaw`
      SELECT COALESCE(MAX("ordem"), -1) as maxordem
      FROM "SetorConfig"
      WHERE "workspaceId" = ${workspaceId}
    ` as any[]

    const proximaOrdem = (result[0]?.maxordem ?? -1) + 1
    const id = gerarId()

    await prisma.$executeRaw`
      INSERT INTO "SetorConfig" ("id", "workspaceId", "nome", "ordem", "ativo")
      VALUES (${id}, ${workspaceId}, ${nome.trim()}, ${proximaOrdem}, true)
    `

    const novos = await prisma.$queryRaw`
      SELECT * FROM "SetorConfig" WHERE "id" = ${id}
    ` as any[]

    return NextResponse.json({ setor: novos[0] })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
