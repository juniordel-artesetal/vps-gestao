import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    const rows = await prisma.$queryRaw`
      SELECT * FROM "SetorConfig"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!rows.length) return NextResponse.json({ error: 'Setor não encontrado' }, { status: 404 })

    return NextResponse.json(serialize(rows[0]))
  } catch (e) {
    console.error('GET /api/config/producao/[id]:', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId
    const body = await req.json()
    const { nome, icone, cor, ordem, ativo } = body

    // Verifica pertencimento ao workspace
    const exists = await prisma.$queryRaw`
      SELECT id FROM "SetorConfig"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!exists.length) return NextResponse.json({ error: 'Setor não encontrado' }, { status: 404 })

    await prisma.$executeRaw`
      UPDATE "SetorConfig" SET
        "nome"  = COALESCE(${nome  ?? null}, "nome"),
        "icone" = COALESCE(${icone ?? null}, "icone"),
        "cor"   = COALESCE(${cor   ?? null}, "cor"),
        "ordem" = COALESCE(${ordem != null ? Number(ordem) : null}::int, "ordem"),
        "ativo" = COALESCE(${ativo != null ? Boolean(ativo) : null}, "ativo")
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `

    const updated = await prisma.$queryRaw`
      SELECT * FROM "SetorConfig" WHERE "id" = ${id}
    ` as any[]

    return NextResponse.json(serialize(updated[0]))
  } catch (e) {
    console.error('PUT /api/config/producao/[id]:', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    // Verifica pertencimento ao workspace
    const exists = await prisma.$queryRaw`
      SELECT id FROM "SetorConfig"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!exists.length) return NextResponse.json({ error: 'Setor não encontrado' }, { status: 404 })

    // Remove WorkItems vinculados a este setor para evitar órfãos
    await prisma.$executeRaw`
      DELETE FROM "WorkItem" WHERE "setorId" = ${id}
    `

    // Remove o setor
    await prisma.$executeRaw`
      DELETE FROM "SetorConfig"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/config/producao/[id]:', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
