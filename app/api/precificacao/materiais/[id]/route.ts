// app/api/precificacao/materiais/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { id } = await params
    const workspaceId = session.user.workspaceId
    const { nome, unidade, precoPacote, qtdPacote, fornecedor } = await req.json()
    const precoUnidade = Number(precoPacote) / Number(qtdPacote)
    await prisma.$executeRaw`
      UPDATE "PrecMaterial" SET
        "nome"=${nome}, "unidade"=${unidade||'unidade'},
        "precoPacote"=${Number(precoPacote)}, "qtdPacote"=${Number(qtdPacote)},
        "precoUnidade"=${precoUnidade}, "fornecedor"=${fornecedor||null}, "updatedAt"=NOW()
      WHERE "id"=${id} AND "workspaceId"=${workspaceId}
    `
    return NextResponse.json({ ok: true })
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { id } = await params
    const workspaceId = session.user.workspaceId
    await prisma.$executeRaw`UPDATE "PrecMaterial" SET "ativo"=false WHERE "id"=${id} AND "workspaceId"=${workspaceId}`
    return NextResponse.json({ ok: true })
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}
