import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// GET — carrega dados do workspace e tema
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const workspaceId = session.user.workspaceId

    const workspaces = await prisma.$queryRaw`
      SELECT w."nome", t."corPrimaria", t."presetNome", t."modo"
      FROM "Workspace" w
      LEFT JOIN "WorkspaceTheme" t ON t."workspaceId" = w."id"
      WHERE w."id" = ${workspaceId}
      LIMIT 1
    ` as any[]

    const ws = workspaces[0]

    return NextResponse.json({
      nomeNegocio: ws?.nome || '',
      corPrimaria: ws?.corPrimaria || '#f97316',
      presetNome:  ws?.presetNome  || 'laranja',
      modo:        ws?.modo        || 'light',
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — salva configurações
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { nomeNegocio, corPrimaria, presetNome, modo } = await req.json()
    const workspaceId = session.user.workspaceId

    // Atualiza nome do workspace
    if (nomeNegocio) {
      await prisma.$executeRaw`
        UPDATE "Workspace"
        SET "nome" = ${nomeNegocio}, "updatedAt" = NOW()
        WHERE "id" = ${workspaceId}
      `
    }

    // Verifica se já tem tema
    const temas = await prisma.$queryRaw`
      SELECT id FROM "WorkspaceTheme" WHERE "workspaceId" = ${workspaceId}
    ` as any[]

    if (temas.length > 0) {
      await prisma.$executeRaw`
        UPDATE "WorkspaceTheme"
        SET
          "corPrimaria" = ${corPrimaria},
          "presetNome"  = ${presetNome},
          "modo"        = ${modo},
          "updatedAt"   = NOW()
        WHERE "workspaceId" = ${workspaceId}
      `
    } else {
      const id = gerarId()
      await prisma.$executeRaw`
        INSERT INTO "WorkspaceTheme" ("id", "workspaceId", "corPrimaria", "presetNome", "modo")
        VALUES (${id}, ${workspaceId}, ${corPrimaria}, ${presetNome}, ${modo})
      `
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
