import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// GET — lista campos de um setor
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const setorId = searchParams.get('setorId')

    if (!setorId) return NextResponse.json({ error: 'setorId obrigatório' }, { status: 400 })

    const workspaceId = session.user.workspaceId

    const campos = await prisma.$queryRaw`
      SELECT * FROM "SetorCampo"
      WHERE "setorId" = ${setorId}
      AND "workspaceId" = ${workspaceId}
      ORDER BY "ordem" ASC
    ` as any[]

    return NextResponse.json({ campos })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — cria novo campo
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { setorId, nome, tipo, obrigatorio, opcoes, placeholder } = await req.json()

    if (!setorId || !nome || !tipo) {
      return NextResponse.json({ error: 'setorId, nome e tipo são obrigatórios' }, { status: 400 })
    }

    const tiposValidos = ['texto', 'numero', 'data', 'lista', 'checkbox', 'usuario', 'arquivo', 'cor']
    if (!tiposValidos.includes(tipo)) {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    }

    const workspaceId = session.user.workspaceId

    // Pega maior ordem atual
    const result = await prisma.$queryRaw`
      SELECT COALESCE(MAX("ordem"), -1) as maxordem
      FROM "SetorCampo"
      WHERE "setorId" = ${setorId} AND "workspaceId" = ${workspaceId}
    ` as any[]

    const proximaOrdem = (result[0]?.maxordem ?? -1) + 1
    const id = gerarId()
    const opcoesJson = opcoes ? JSON.stringify(opcoes) : null

    await prisma.$executeRaw`
      INSERT INTO "SetorCampo"
        ("id", "setorId", "workspaceId", "nome", "tipo", "obrigatorio", "opcoes", "placeholder", "ordem", "ativo")
      VALUES
        (${id}, ${setorId}, ${workspaceId}, ${nome}, ${tipo}, ${obrigatorio ?? false}, ${opcoesJson}, ${placeholder ?? null}, ${proximaOrdem}, true)
    `

    const novos = await prisma.$queryRaw`
      SELECT * FROM "SetorCampo" WHERE "id" = ${id}
    ` as any[]

    return NextResponse.json({ campo: novos[0] })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
