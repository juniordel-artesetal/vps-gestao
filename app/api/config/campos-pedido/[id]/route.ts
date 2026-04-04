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
      SELECT * FROM "PedidoCampoConfig"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!rows.length) return NextResponse.json({ error: 'Campo não encontrado' }, { status: 404 })

    return NextResponse.json(serialize(rows[0]))
  } catch (e) {
    console.error('GET /api/config/campos-pedido/[id]:', e)
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
    const { nome, tipo, opcoes, placeholder, usarComoFiltro, usarNaMassa, ativo, ordem } = body

    // Verifica pertencimento
    const exists = await prisma.$queryRaw`
      SELECT id FROM "PedidoCampoConfig"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!exists.length) return NextResponse.json({ error: 'Campo não encontrado' }, { status: 404 })

    const opcoesJson = opcoes !== undefined ? JSON.stringify(opcoes) : null

    await prisma.$executeRaw`
      UPDATE "PedidoCampoConfig" SET
        "nome"           = COALESCE(${nome            ?? null}, "nome"),
        "tipo"           = COALESCE(${tipo            ?? null}, "tipo"),
        "opcoes"         = COALESCE(${opcoesJson      ?? null}, "opcoes"),
        "placeholder"    = COALESCE(${placeholder     ?? null}, "placeholder"),
        "usarComoFiltro" = COALESCE(${usarComoFiltro  != null ? Boolean(usarComoFiltro) : null}, "usarComoFiltro"),
        "usarNaMassa"    = COALESCE(${usarNaMassa     != null ? Boolean(usarNaMassa)    : null}, "usarNaMassa"),
        "ativo"          = COALESCE(${ativo           != null ? Boolean(ativo)          : null}, "ativo"),
        "ordem"          = COALESCE(${ordem           != null ? Number(ordem)           : null}::int, "ordem")
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `

    const updated = await prisma.$queryRaw`
      SELECT * FROM "PedidoCampoConfig" WHERE "id" = ${id}
    ` as any[]

    return NextResponse.json(serialize(updated[0]))
  } catch (e) {
    console.error('PUT /api/config/campos-pedido/[id]:', e)
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

    // Verifica pertencimento
    const exists = await prisma.$queryRaw`
      SELECT id FROM "PedidoCampoConfig"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!exists.length) return NextResponse.json({ error: 'Campo não encontrado' }, { status: 404 })

    // Soft delete — mantém histórico nos pedidos antigos mas some do formulário
    await prisma.$executeRaw`
      UPDATE "PedidoCampoConfig"
      SET "ativo" = false
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/config/campos-pedido/[id]:', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
