// app/api/stars/indicacoes/route.ts
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

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const indicacoes = await prisma.$queryRaw`
      SELECT * FROM "VpsIndicacao"
      WHERE "workspaceId" = ${session.user.workspaceId}
      ORDER BY "createdAt" DESC
    ` as any[]
    return NextResponse.json(serialize(indicacoes))
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

    const { nomeIndicada, contatoIndicada } = await req.json()
    if (!nomeIndicada?.trim() || !contatoIndicada?.trim()) {
      return NextResponse.json({ error: 'Nome e contato são obrigatórios' }, { status: 400 })
    }

    // Verificar duplicata
    const existente = await prisma.$queryRaw`
      SELECT id FROM "VpsIndicacao"
      WHERE "workspaceId" = ${workspaceId}
        AND "contatoIndicada" = ${contatoIndicada.trim()}
      LIMIT 1
    ` as any[]
    if (existente.length > 0) {
      return NextResponse.json({ error: 'Você já indicou este contato.' }, { status: 400 })
    }

    const id = gerarId()
    await prisma.$executeRaw`
      INSERT INTO "VpsIndicacao" ("id","workspaceId","nomeIndicada","contatoIndicada","status","pontosCreditados","createdAt")
      VALUES (${id}, ${workspaceId}, ${nomeIndicada.trim()}, ${contatoIndicada.trim()}, 'PENDENTE', false, NOW())
    `

    return NextResponse.json({ ok: true, id })
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
