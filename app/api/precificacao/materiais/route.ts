// ============================================================
// ARQUIVO 1: app/api/precificacao/materiais/route.ts
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const workspaceId = session.user.workspaceId
    // status: default = só ativos (compat); 'inativos' | 'todos' para as ações em massa
    const status = new URL(req.url).searchParams.get('status')
    const ativoFilter = status === 'inativos' ? false : status === 'todos' ? null : true
    const materiais = await prisma.$queryRaw`
      SELECT "id","workspaceId","nome","unidade","precoPacote","qtdPacote","precoUnidade",
             "fornecedor","descricao","ativo","createdAt","updatedAt",
             EXISTS(SELECT 1 FROM "PrecMaterialItem" mi WHERE mi."materialId" = "PrecMaterial"."id") AS "vinculado"
      FROM "PrecMaterial"
      WHERE "workspaceId" = ${workspaceId}
        AND (${ativoFilter}::boolean IS NULL OR "ativo" = ${ativoFilter})
      ORDER BY "nome" ASC
    ` as any[]
    return NextResponse.json(materiais)
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { nome, unidade, precoPacote, qtdPacote, fornecedor } = await req.json()
    if (!nome || !precoPacote || !qtdPacote) return NextResponse.json({ error: 'Nome, preço e quantidade são obrigatórios' }, { status: 400 })
    const workspaceId  = session.user.workspaceId
    const precoUnidade = Number(precoPacote) / Number(qtdPacote)
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    await prisma.$executeRaw`
      INSERT INTO "PrecMaterial" ("id","workspaceId","nome","unidade","precoPacote","qtdPacote","precoUnidade","fornecedor")
      VALUES (${id}, ${workspaceId}, ${nome}, ${unidade || 'unidade'}, ${Number(precoPacote)}, ${Number(qtdPacote)}, ${precoUnidade}, ${fornecedor || null})
    `
    return NextResponse.json({ id })
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}
