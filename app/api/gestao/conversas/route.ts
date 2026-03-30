// app/api/gestao/conversas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — lista conversas do workspace (últimas 100, até 30 dias)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const limite30dias = new Date()
  limite30dias.setDate(limite30dias.getDate() - 30)

  const rows = await prisma.$queryRaw`
    SELECT id, titulo, periodo, "createdAt", "updatedAt",
           LENGTH(mensagens) AS tamanho
    FROM "AiConversa"
    WHERE "workspaceId" = ${workspaceId}
      AND "updatedAt" >= ${limite30dias}
    ORDER BY "updatedAt" DESC
    LIMIT 100
  ` as any[]

  return NextResponse.json(rows)
}

// POST — cria nova conversa
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const userId = session.user.id || session.user.email || 'admin'
  const { titulo, periodo, mensagens } = await req.json()

  const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
  const mensagensJson = JSON.stringify(mensagens || [])

  await prisma.$executeRaw`
    INSERT INTO "AiConversa" ("id","workspaceId","userId","titulo","periodo","mensagens")
    VALUES (${id}, ${workspaceId}, ${userId}, ${titulo || 'Nova conversa'}, ${periodo || null}, ${mensagensJson})
  `

  // Limpa conversas antigas além de 100 por workspace
  await prisma.$executeRaw`
    DELETE FROM "AiConversa"
    WHERE "workspaceId" = ${workspaceId}
      AND id NOT IN (
        SELECT id FROM "AiConversa"
        WHERE "workspaceId" = ${workspaceId}
        ORDER BY "updatedAt" DESC
        LIMIT 100
      )
  `

  return NextResponse.json({ id })
}
