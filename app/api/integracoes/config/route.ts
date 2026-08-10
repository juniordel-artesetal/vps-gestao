import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { encryptToken } from '@/lib/logistica/cripto'

export const dynamic = 'force-dynamic'

function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }
const MARKETPLACES = ['mercadolivre', 'shopee', 'tiktok']

// GET — config de sync por marketplace do workspace (sem credencial em claro).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const rows = await prisma.$queryRaw`
    SELECT "marketplace","conectado","syncEstoque","importarPedidos", ("credencialCripto" IS NOT NULL) AS "temCredencial"
    FROM "IntegracaoLoja" WHERE "workspaceId" = ${session.user.workspaceId}
  ` as any[]
  const map: Record<string, any> = {}
  for (const r of rows) map[r.marketplace] = r
  return NextResponse.json(serialize({ integracoes: map }))
}

// PUT — salva config de UM marketplace. ADMIN.
// body: { marketplace, syncEstoque?, importarPedidos?, credencial? }
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId
  const b = await req.json().catch(() => ({}))
  const mkt = String(b.marketplace || '')
  if (!MARKETPLACES.includes(mkt)) return NextResponse.json({ error: 'Marketplace inválido' }, { status: 400 })

  const sync = b.syncEstoque === 'duplo' ? 'duplo' : 'puxar'
  const credCripto = b.credencial ? encryptToken(String(b.credencial)) : null

  const [ex] = await prisma.$queryRaw`SELECT "id" FROM "IntegracaoLoja" WHERE "workspaceId" = ${workspaceId} AND "marketplace" = ${mkt} LIMIT 1` as any[]
  if (ex) {
    await prisma.$executeRaw`
      UPDATE "IntegracaoLoja"
      SET "syncEstoque" = ${sync}, "importarPedidos" = ${b.importarPedidos === true},
          "credencialCripto" = COALESCE(${credCripto}, "credencialCripto"), "updatedAt" = NOW()
      WHERE "workspaceId" = ${workspaceId} AND "marketplace" = ${mkt}
    `
  } else {
    await prisma.$executeRaw`
      INSERT INTO "IntegracaoLoja" ("id","workspaceId","marketplace","conectado","syncEstoque","importarPedidos","credencialCripto","updatedAt")
      VALUES (${gerarId()}, ${workspaceId}, ${mkt}, false, ${sync}, ${b.importarPedidos === true}, ${credCripto}, NOW())
    `
  }
  return NextResponse.json({ ok: true })
}
