import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ensureMarketplaceTables } from '@/lib/marketplaceSchema'

const CANAIS = ['shopee', 'mercadolivre']

// GET — config por canal (cria default desligado se não existir na leitura)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  await ensureMarketplaceTables()
  const workspaceId = session.user.workspaceId

  const rows = await prisma.$queryRaw`
    SELECT "canal", "ativo", "diasRepasse"::int AS "diasRepasse"
    FROM "MarketplaceConfig" WHERE "workspaceId" = ${workspaceId}
  ` as any[]
  const map: Record<string, any> = {}
  for (const r of rows) map[r.canal] = { ativo: r.ativo, diasRepasse: r.diasRepasse }
  const canais = CANAIS.map(c => ({ canal: c, ativo: !!map[c]?.ativo, diasRepasse: map[c]?.diasRepasse ?? 7 }))
  return NextResponse.json(serialize({ canais }))
}

// PUT — liga/desliga e define diasRepasse por canal
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  await ensureMarketplaceTables()
  const workspaceId = session.user.workspaceId
  const { canal, ativo, diasRepasse } = await req.json()
  if (!canal || !CANAIS.includes(String(canal))) return NextResponse.json({ error: 'Canal inválido' }, { status: 400 })

  const dias = Math.max(0, parseInt(String(diasRepasse)) || 7)
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
  await prisma.$executeRaw`
    INSERT INTO "MarketplaceConfig" ("id","workspaceId","canal","ativo","diasRepasse")
    VALUES (${id}, ${workspaceId}, ${canal}, ${Boolean(ativo)}, ${dias})
    ON CONFLICT ("workspaceId","canal") DO UPDATE SET
      "ativo" = ${Boolean(ativo)}, "diasRepasse" = ${dias}
  `
  return NextResponse.json({ ok: true, canal, ativo: Boolean(ativo), diasRepasse: dias })
}
