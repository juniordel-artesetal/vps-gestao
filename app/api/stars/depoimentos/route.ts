// app/api/stars/depoimentos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notificarDepoimento } from '@/lib/telegramNotify'

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

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const workspaceId = session.user.workspaceId

    const depoimentos = await prisma.$queryRaw`
      SELECT * FROM "VpsDepoimento"
      WHERE "workspaceId" = ${workspaceId}
      ORDER BY "createdAt" DESC
    ` as any[]
    return NextResponse.json(serialize(depoimentos))
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const workspaceId = session.user.workspaceId

    const { tipo, conteudo } = await req.json()
    if (!tipo || !conteudo?.trim()) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    if (!['TEXTO','VIDEO'].includes(tipo)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

    // Verificar se já tem depoimento pendente/aprovado do mesmo tipo
    const existente = await prisma.$queryRaw`
      SELECT id FROM "VpsDepoimento"
      WHERE "workspaceId" = ${workspaceId}
        AND tipo = ${tipo}
        AND status IN ('PENDENTE','APROVADO')
      LIMIT 1
    ` as any[]
    if (existente.length > 0) {
      return NextResponse.json({ error: 'Você já enviou um depoimento deste tipo. Aguarde a análise.' }, { status: 400 })
    }

    const id = gerarId()
    await prisma.$executeRaw`
      INSERT INTO "VpsDepoimento" ("id","workspaceId","tipo","conteudo","status","pontosCreditados","createdAt")
      VALUES (${id}, ${workspaceId}, ${tipo}, ${conteudo.trim()}, 'PENDENTE', false, NOW())
    `

    // ── Notifica Telegram ────────────────────────────────────────────
    await notificarDepoimento({
      workspaceNome: session.user.workspaceNome || 'Ateliê',
      tipo,
      conteudo: conteudo.trim(),
    }).catch(e => console.error('[TELEGRAM depoimento]', e))

    return NextResponse.json({ ok: true, id })
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
