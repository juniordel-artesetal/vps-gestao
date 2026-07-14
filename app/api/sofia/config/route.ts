import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { avaliarContexto } from '@/lib/sofia/regras'

export const dynamic = 'force-dynamic'

function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

async function garantir(userId: string, workspaceId: string) {
  await prisma.$executeRaw`
    INSERT INTO "SofiaConfig" ("id","userId","workspaceId","ativo","primeiroAcessoVisto","updatedAt")
    VALUES (${gerarId()}, ${userId}, ${workspaceId}, true, false, NOW())
    ON CONFLICT ("userId") DO NOTHING
  `
}

// GET — config da Sofia da usuária + (opcional) dica proativa da rota atual (?rota=).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const userId = session.user.id
  const workspaceId = session.user.workspaceId
  await garantir(userId, workspaceId)

  const [cfg] = await prisma.$queryRaw`
    SELECT "ativo","primeiroAcessoVisto","toursConcluidos","dicasVistas"
    FROM "SofiaConfig" WHERE "userId" = ${userId} LIMIT 1
  ` as any[]

  const rota = new URL(req.url).searchParams.get('rota') || ''
  let dica = null
  if (cfg?.ativo && rota) {
    const vistas: string[] = (() => { try { return JSON.parse(cfg.dicasVistas || '[]') } catch { return [] } })()
    const d = await avaliarContexto(rota, workspaceId)
    if (d && !vistas.includes(d.id)) dica = d
  }

  return NextResponse.json(serialize({
    ativo: cfg?.ativo !== false,
    primeiroAcessoVisto: !!cfg?.primeiroAcessoVisto,
    toursConcluidos: safeArr(cfg?.toursConcluidos),
    dica,
  }))
}

function safeArr(s: string | null): string[] { try { return JSON.parse(s || '[]') } catch { return [] } }

// PUT — atualiza estado. body: { ativo?, primeiroAcessoVisto?, tourConcluido?, dicaVista? }
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const userId = session.user.id
  const workspaceId = session.user.workspaceId
  await garantir(userId, workspaceId)
  const b = await req.json().catch(() => ({}))

  if (typeof b.ativo === 'boolean')
    await prisma.$executeRaw`UPDATE "SofiaConfig" SET "ativo" = ${b.ativo}, "updatedAt" = NOW() WHERE "userId" = ${userId}`
  if (b.primeiroAcessoVisto === true)
    await prisma.$executeRaw`UPDATE "SofiaConfig" SET "primeiroAcessoVisto" = true, "updatedAt" = NOW() WHERE "userId" = ${userId}`

  if (b.tourConcluido || b.dicaVista) {
    const [cfg] = await prisma.$queryRaw`SELECT "toursConcluidos","dicasVistas" FROM "SofiaConfig" WHERE "userId" = ${userId} LIMIT 1` as any[]
    if (b.tourConcluido) {
      const arr = new Set(safeArr(cfg?.toursConcluidos)); arr.add(String(b.tourConcluido))
      await prisma.$executeRaw`UPDATE "SofiaConfig" SET "toursConcluidos" = ${JSON.stringify([...arr])}, "updatedAt" = NOW() WHERE "userId" = ${userId}`
    }
    if (b.dicaVista) {
      const arr = new Set(safeArr(cfg?.dicasVistas)); arr.add(String(b.dicaVista))
      await prisma.$executeRaw`UPDATE "SofiaConfig" SET "dicasVistas" = ${JSON.stringify([...arr])}, "updatedAt" = NOW() WHERE "userId" = ${userId}`
    }
  }

  return NextResponse.json({ ok: true })
}
