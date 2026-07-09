// ============================================================
// ARQUIVO 1: app/api/precificacao/materiais/route.ts
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ensureColunasTecido, numPos, derivarPrecoMaterial } from '@/lib/precoTecido'

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
             "precoMetroLinear","larguraTecido",
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
    await ensureColunasTecido()
    const { nome, unidade, precoPacote, qtdPacote, fornecedor, precoMetroLinear, larguraTecido } = await req.json()
    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

    const der = derivarPrecoMaterial({
      unidade: unidade || 'unidade',
      precoPacote: numPos(precoPacote), qtdPacote: numPos(qtdPacote),
      precoMetroLinear: numPos(precoMetroLinear), larguraTecido: numPos(larguraTecido),
    })
    if (!der.ok) return NextResponse.json({ error: 'Informe o preço e a quantidade (ou, para tecido em m², o preço por metro e a largura)' }, { status: 400 })

    const workspaceId  = session.user.workspaceId
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    await prisma.$executeRaw`
      INSERT INTO "PrecMaterial" ("id","workspaceId","nome","unidade","precoPacote","qtdPacote","precoUnidade","fornecedor","precoMetroLinear","larguraTecido")
      VALUES (${id}, ${workspaceId}, ${nome}, ${unidade || 'unidade'}, ${der.precoPacoteStore}, ${der.qtdPacoteStore}, ${der.precoUnidade}, ${fornecedor || null}, ${der.precoMetroLinear}, ${der.larguraTecido})
    `
    return NextResponse.json({ id })
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}
