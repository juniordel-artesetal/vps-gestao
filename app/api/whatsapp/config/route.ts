import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { encryptToken } from '@/lib/logistica/cripto'

export const dynamic = 'force-dynamic'

function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// GET — config local do WhatsApp do workspace. NUNCA devolve a credencial em claro.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const [row] = await prisma.$queryRaw`
    SELECT "numero","eventos","vozAtiva","conectado", ("credencialCripto" IS NOT NULL) AS "temCredencial"
    FROM "WhatsappConfig" WHERE "workspaceId" = ${session.user.workspaceId} LIMIT 1
  ` as any[]
  return NextResponse.json(serialize(row || { numero: null, eventos: null, vozAtiva: false, conectado: false, temCredencial: false }))
}

// PUT — salva config local (número, eventos, vozAtiva, credencial criptografada). ADMIN.
// body: { numero?, eventos?: string[], vozAtiva?, credencial? }
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId
  const b = await req.json().catch(() => ({}))

  const eventos = Array.isArray(b.eventos) ? JSON.stringify(b.eventos) : null
  const credCripto = b.credencial ? encryptToken(String(b.credencial)) : null

  const [ex] = await prisma.$queryRaw`SELECT "id" FROM "WhatsappConfig" WHERE "workspaceId" = ${workspaceId} LIMIT 1` as any[]
  if (ex) {
    await prisma.$executeRaw`
      UPDATE "WhatsappConfig"
      SET "numero" = ${b.numero ?? null}, "eventos" = COALESCE(${eventos}, "eventos"),
          "vozAtiva" = ${b.vozAtiva === true},
          "credencialCripto" = COALESCE(${credCripto}, "credencialCripto"),
          "updatedAt" = NOW()
      WHERE "workspaceId" = ${workspaceId}
    `
  } else {
    await prisma.$executeRaw`
      INSERT INTO "WhatsappConfig" ("id","workspaceId","numero","eventos","vozAtiva","credencialCripto","conectado","updatedAt")
      VALUES (${gerarId()}, ${workspaceId}, ${b.numero ?? null}, ${eventos}, ${b.vozAtiva === true}, ${credCripto}, false, NOW())
    `
  }
  return NextResponse.json({ ok: true })
}
