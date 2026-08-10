// app/api/stars/resgatar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k,v]) => [k, serialize(v)]))
  return obj
}

// GET — prêmios disponíveis + resgates do workspace
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const workspaceId = session.user.workspaceId
    const { searchParams } = new URL(req.url)
    const tipo = searchParams.get('tipo') // 'premios' | 'meus'

    if (tipo === 'meus') {
      const resgates = await prisma.$queryRaw`
        SELECT r.*, p.nome AS "premioNome", p.tipo AS "premioTipo"
        FROM "VpsStarsResgate" r
        LEFT JOIN "VpsStarsPremio" p ON p.id = r."premioId"
        WHERE r."workspaceId" = ${workspaceId}
        ORDER BY r."createdAt" DESC
      ` as any[]
      return NextResponse.json(serialize(resgates))
    }

    // Catálogo de prêmios ativos
    const premios = await prisma.$queryRaw`
      SELECT * FROM "VpsStarsPremio"
      WHERE ativo = true
      ORDER BY "pontosNecessarios" ASC
    ` as any[]
    return NextResponse.json(serialize(premios))
  } catch (error) {
    console.error('[VpsStars/resgatar GET]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — solicitar resgate
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const workspaceId = session.user.workspaceId
    const { premioId, endereco } = await req.json()

    // Verificar prêmio
    const premios = await prisma.$queryRaw`
      SELECT * FROM "VpsStarsPremio" WHERE id = ${premioId} AND ativo = true LIMIT 1
    ` as any[]
    if (!premios.length) return NextResponse.json({ error: 'Prêmio não encontrado' }, { status: 404 })
    const premio = premios[0]

    // Verificar saldo
    const saldoRows = await prisma.$queryRaw`
      SELECT pontos FROM "VpsStars" WHERE "workspaceId" = ${workspaceId} LIMIT 1
    ` as any[]
    const pontos = Number(saldoRows[0]?.pontos ?? 0)
    if (pontos < Number(premio.pontosNecessarios)) {
      return NextResponse.json({ error: `Pontos insuficientes. Você tem ${pontos} e precisa de ${premio.pontosNecessarios}` }, { status: 400 })
    }

    // Verificar quantidade disponível
    if (premio.quantidade !== null && Number(premio.quantidade) <= 0) {
      return NextResponse.json({ error: 'Prêmio esgotado' }, { status: 400 })
    }

    // Debitar pontos
    await prisma.$executeRaw`
      UPDATE "VpsStars"
      SET pontos = pontos - ${Number(premio.pontosNecessarios)}, "updatedAt" = NOW()
      WHERE "workspaceId" = ${workspaceId}
    `

    // Reduzir quantidade se limitada
    if (premio.quantidade !== null) {
      await prisma.$executeRaw`
        UPDATE "VpsStarsPremio" SET quantidade = quantidade - 1 WHERE id = ${premioId}
      `
    }

    // Criar resgate
    const id = gerarId()
    await prisma.$executeRaw`
      INSERT INTO "VpsStarsResgate" ("id","workspaceId","premioId","pontosUsados","status","observacoes","createdAt")
      VALUES (${id}, ${workspaceId}, ${premioId}, ${Number(premio.pontosNecessarios)}, 'PENDENTE', ${endereco ?? null}, NOW())
    `

    // Log
    const logId = gerarId()
    await prisma.$executeRaw`
      INSERT INTO "VpsStarsLog" ("id","workspaceId","motivo","pontos","descricao","createdAt")
      VALUES (${logId}, ${workspaceId}, 'RESGATE', ${-Number(premio.pontosNecessarios)}, ${`Resgate: ${premio.nome}`}, NOW())
    `

    return NextResponse.json({ ok: true, resgateId: id })
  } catch (error) {
    console.error('[VpsStars/resgatar POST]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
