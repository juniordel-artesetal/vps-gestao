// ══════════════════════════════════════════════════════════════
// Destino: app/api/fornecedores/[id]/route.ts
// Função : GET detalhe + compras
//          PUT editar fornecedor
//          DELETE excluir (cascade compras)
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId

  try {
    const rows = await prisma.$queryRaw`
      SELECT * FROM "Fornecedor"
      WHERE id = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!rows[0]) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    const compras = await prisma.$queryRaw`
      SELECT * FROM "FornecedorCompra"
      WHERE "fornecedorId" = ${id}
      ORDER BY "data" DESC, "createdAt" DESC
    ` as any[]

    return NextResponse.json(serialize({ ...rows[0], compras }))
  } catch (err) {
    console.error('[GET /api/fornecedores/[id]]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId

  try {
    const existing = await prisma.$queryRaw`
      SELECT id FROM "Fornecedor" WHERE id = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]
    if (!existing[0]) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    const body = await req.json()
    const { nome, contato, email, whatsapp, cnpjCpf, categorias, observacoes, avaliacao, ativo } = body

    const categoriasStr = JSON.stringify(categorias || [])
    const av            = Math.min(5, Math.max(1, Number(avaliacao) || 5))
    const ativoVal      = ativo !== false

    await prisma.$executeRaw`
      UPDATE "Fornecedor" SET
        "nome"        = ${nome},
        "contato"     = ${contato     || null},
        "email"       = ${email       || null},
        "whatsapp"    = ${whatsapp    || null},
        "cnpjCpf"     = ${cnpjCpf    || null},
        "categorias"  = ${categoriasStr},
        "observacoes" = ${observacoes || null},
        "avaliacao"   = ${av},
        "ativo"       = ${ativoVal},
        "updatedAt"   = NOW()
      WHERE id = ${id}
    `

    const rows = await prisma.$queryRaw`
      SELECT f.*,
        COALESCE(SUM(fc."valor"),   0) AS "totalCompras",
        COALESCE(COUNT(fc.id)::int, 0) AS "qtdCompras"
      FROM "Fornecedor" f
      LEFT JOIN "FornecedorCompra" fc ON fc."fornecedorId" = f.id
      WHERE f.id = ${id}
      GROUP BY f.id
    ` as any[]

    return NextResponse.json(serialize(rows[0]))
  } catch (err) {
    console.error('[PUT /api/fornecedores/[id]]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Apenas administradores podem excluir' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId

  try {
    // FornecedorCompra é removida em cascata pelo ON DELETE CASCADE
    await prisma.$executeRaw`
      DELETE FROM "Fornecedor" WHERE id = ${id} AND "workspaceId" = ${workspaceId}
    `
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/fornecedores/[id]]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
