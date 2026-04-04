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
      SELECT * FROM "PrecMaterial"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!rows.length) return NextResponse.json({ error: 'Material não encontrado' }, { status: 404 })

    return NextResponse.json(serialize(rows[0]))
  } catch (e) {
    console.error('GET /api/precificacao/materiais/[id]:', e)
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
    const { nome, unidade, precoPacote, qtdPacote, fornecedor, ativo } = body

    // Verifica pertencimento ao workspace
    const exists = await prisma.$queryRaw`
      SELECT id, "precoPacote", "qtdPacote" FROM "PrecMaterial"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!exists.length) return NextResponse.json({ error: 'Material não encontrado' }, { status: 404 })

    // Recalcula precoUnidade se preço ou qtd foram enviados
    const precoAtual   = parseFloat(String(exists[0].precoPacote))
    const qtdAtual     = parseFloat(String(exists[0].qtdPacote))
    const novoPreco    = precoPacote != null ? parseFloat(String(precoPacote)) : precoAtual
    const novaQtd      = qtdPacote   != null ? parseFloat(String(qtdPacote))   : qtdAtual
    const precoUnidade = novaQtd > 0 ? novoPreco / novaQtd : 0

    await prisma.$executeRaw`
      UPDATE "PrecMaterial" SET
        "nome"         = COALESCE(${nome       ?? null}, "nome"),
        "unidade"      = COALESCE(${unidade    ?? null}, "unidade"),
        "precoPacote"  = ${novoPreco},
        "qtdPacote"    = ${novaQtd},
        "precoUnidade" = ${precoUnidade},
        "fornecedor"   = COALESCE(${fornecedor ?? null}, "fornecedor"),
        "ativo"        = COALESCE(${ativo      != null ? Boolean(ativo) : null}, "ativo")
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `

    const updated = await prisma.$queryRaw`
      SELECT * FROM "PrecMaterial" WHERE "id" = ${id}
    ` as any[]

    return NextResponse.json(serialize(updated[0]))
  } catch (e) {
    console.error('PUT /api/precificacao/materiais/[id]:', e)
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
      SELECT id FROM "PrecMaterial"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    ` as any[]

    if (!exists.length) return NextResponse.json({ error: 'Material não encontrado' }, { status: 404 })

    // Verifica se está em uso em alguma variação de produto
    const emUso = await prisma.$queryRaw`
      SELECT COUNT(*)::int as total FROM "PrecMaterialItem"
      WHERE "materialId" = ${id}
    ` as any[]

    if (Number(emUso[0].total) > 0) {
      // Soft delete — mantém integridade dos produtos que usam este material
      await prisma.$executeRaw`
        UPDATE "PrecMaterial" SET "ativo" = false
        WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
      `
      return NextResponse.json({
        ok: true,
        aviso: 'Material desativado pois está em uso em produtos. Ele não aparecerá mais nas listagens.'
      })
    }

    // Hard delete se não está em uso
    await prisma.$executeRaw`
      DELETE FROM "PrecMaterial"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/precificacao/materiais/[id]:', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
