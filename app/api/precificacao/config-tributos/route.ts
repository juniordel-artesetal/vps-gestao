// app/api/precificacao/config-tributos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const workspaceId = session.user.workspaceId
    const rows = await prisma.$queryRaw`
      SELECT * FROM "PrecConfigTributaria" WHERE "workspaceId"=${workspaceId} LIMIT 1
    ` as any[]
    return NextResponse.json(rows[0] || null)
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { regime, aliquotaPadrao, observacoes } = await req.json()
    const workspaceId = session.user.workspaceId
    // Usa workspaceId como chave única — cada workspace tem exatamente 1 config
    await prisma.$executeRaw`
      INSERT INTO "PrecConfigTributaria" ("id","workspaceId","regime","aliquotaPadrao","observacoes","updatedAt")
      VALUES (${workspaceId + '_tributos'}, ${workspaceId}, ${regime}, ${Number(aliquotaPadrao)}, ${observacoes||null}, NOW())
      ON CONFLICT ("workspaceId") DO UPDATE SET
        "regime"=${regime}, "aliquotaPadrao"=${Number(aliquotaPadrao)},
        "observacoes"=${observacoes||null}, "updatedAt"=NOW()
    `
    return NextResponse.json({ ok: true })
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}
