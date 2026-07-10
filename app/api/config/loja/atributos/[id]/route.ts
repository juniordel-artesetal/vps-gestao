import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Confirma que o atributo pertence ao workspace (via produto).
async function atributoDoWs(id: string, workspaceId: string) {
  const r = await prisma.$queryRaw`
    SELECT a."id" FROM "LojaAtributo" a JOIN "PrecProduto" p ON p."id" = a."produtoId"
    WHERE a."id" = ${id} AND p."workspaceId" = ${workspaceId} LIMIT 1` as any[]
  return r.length > 0
}
async function opcaoDoWs(id: string, workspaceId: string) {
  const r = await prisma.$queryRaw`SELECT 1 FROM "LojaAtributoOpcao" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId} LIMIT 1` as any[]
  return r.length > 0
}

// PUT { tipo:'atributo'|'opcao', nome?/valor?, ordem? }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { id } = await params
    const workspaceId = session.user.workspaceId
    const { tipo, nome, valor, ordem } = await req.json()

    if (tipo === 'opcao') {
      if (!(await opcaoDoWs(id, workspaceId))) return NextResponse.json({ error: 'Opção não encontrada' }, { status: 404 })
      if (valor !== undefined) await prisma.$executeRaw`UPDATE "LojaAtributoOpcao" SET "valor" = ${String(valor).trim().slice(0, 80)} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
      if (ordem !== undefined) await prisma.$executeRaw`UPDATE "LojaAtributoOpcao" SET "ordem" = ${Number(ordem) || 0} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
      return NextResponse.json({ ok: true })
    }

    if (!(await atributoDoWs(id, workspaceId))) return NextResponse.json({ error: 'Atributo não encontrado' }, { status: 404 })
    if (nome !== undefined) await prisma.$executeRaw`UPDATE "LojaAtributo" SET "nome" = ${String(nome).trim().slice(0, 60)} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (ordem !== undefined) await prisma.$executeRaw`UPDATE "LojaAtributo" SET "ordem" = ${Number(ordem) || 0} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[config/loja/atributos/[id] PUT]', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE ?tipo=atributo|opcao — remove em cascata os mapeamentos afetados
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { id } = await params
    const workspaceId = session.user.workspaceId
    const tipo = new URL(req.url).searchParams.get('tipo') || 'atributo'

    if (tipo === 'opcao') {
      if (!(await opcaoDoWs(id, workspaceId))) return NextResponse.json({ error: 'Opção não encontrada' }, { status: 404 })
      await prisma.$executeRaw`DELETE FROM "LojaVariacaoOpcao" WHERE "opcaoId" = ${id} AND "workspaceId" = ${workspaceId}`
      await prisma.$executeRaw`DELETE FROM "LojaAtributoOpcao" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
      return NextResponse.json({ ok: true })
    }

    if (!(await atributoDoWs(id, workspaceId))) return NextResponse.json({ error: 'Atributo não encontrado' }, { status: 404 })
    await prisma.$executeRaw`DELETE FROM "LojaVariacaoOpcao" WHERE "atributoId" = ${id} AND "workspaceId" = ${workspaceId}`
    await prisma.$executeRaw`DELETE FROM "LojaAtributoOpcao" WHERE "atributoId" = ${id} AND "workspaceId" = ${workspaceId}`
    await prisma.$executeRaw`DELETE FROM "LojaAtributo" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[config/loja/atributos/[id] DELETE]', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
