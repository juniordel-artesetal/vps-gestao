import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId

  try {
    const body = await req.json()
    const { nome, contato, email, whatsapp, cnpjCpf, categorias, observacoes, avaliacao, ativo } = body

    const categoriasStr = categorias !== undefined ? JSON.stringify(categorias) : undefined
    const av = avaliacao !== undefined ? Math.min(5, Math.max(1, Number(avaliacao))) : undefined

    // Monta update dinâmico só com campos enviados
    await prisma.$executeRaw`
      UPDATE "Fornecedor" SET
        "nome"        = COALESCE(${nome        ?? null}, "nome"),
        "contato"     = COALESCE(${contato     ?? null}, "contato"),
        "email"       = COALESCE(${email       ?? null}, "email"),
        "whatsapp"    = COALESCE(${whatsapp    ?? null}, "whatsapp"),
        "cnpjCpf"     = COALESCE(${cnpjCpf     ?? null}, "cnpjCpf"),
        "categorias"  = COALESCE(${categoriasStr ?? null}::text, "categorias"),
        "observacoes" = COALESCE(${observacoes ?? null}, "observacoes"),
        "avaliacao"   = COALESCE(${av          ?? null}, "avaliacao"),
        "ativo"       = COALESCE(${ativo       ?? null}, "ativo"),
        "updatedAt"   = NOW()
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `

    const rows = await prisma.$queryRaw`
      SELECT * FROM "Fornecedor" WHERE id = ${id}
    ` as any[]

    return NextResponse.json(serialize(rows[0]))
  } catch (err) {
    console.error('[PUT /api/fornecedores/[id]]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId

  try {
    await prisma.$executeRaw`
      DELETE FROM "Fornecedor"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/fornecedores/[id]]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
