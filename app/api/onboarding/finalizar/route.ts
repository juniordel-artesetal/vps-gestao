import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const workspaceId = session.user.workspaceId
  const { segmento, setores } = await req.json()

  if (!setores || setores.length === 0) {
    return NextResponse.json({ error: 'Adicione pelo menos um setor' }, { status: 400 })
  }

  // Proteção: verifica se já existem setores para este workspace
  const existentes = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS total FROM "SetorConfig"
    WHERE "workspaceId" = ${workspaceId}
  ` as { total: number }[]

  if (existentes[0]?.total > 0) {
    // Workspace já configurado — vai para dashboard sem inserir nada
    return NextResponse.json({ ok: true, jaConfigurado: true })
  }

  // Inserir setores novos
  for (let i = 0; i < setores.length; i++) {
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    await prisma.$executeRaw`
      INSERT INTO "SetorConfig" ("id","workspaceId","nome","ordem","ativo","createdAt")
      VALUES (${id}, ${workspaceId}, ${setores[i]}, ${i + 1}, true, NOW())
    `
  }

  // Salvar segmento no workspace (campo opcional)
  try {
    await prisma.$executeRaw`
      UPDATE "Workspace" SET "segmento" = ${segmento} WHERE "id" = ${workspaceId}
    `
  } catch { /* coluna pode não existir ainda */ }

  return NextResponse.json({ ok: true })
}
