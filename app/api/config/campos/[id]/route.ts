import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (typeof obj === 'object' && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') {
    const result: any = {}
    for (const key of Object.keys(obj)) result[key] = serialize(obj[key])
    return result
  }
  return obj
}

// GET — busca campo individual por id (consulta auxiliar)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    const rows = await prisma.$queryRaw`
      SELECT "id", "setorId", "workspaceId", "nome", "tipo", "obrigatorio",
             "opcoes", "placeholder", "ordem", "ativo"
      FROM "SetorCampo"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
      LIMIT 1
    ` as any[]

    if (rows.length === 0) return NextResponse.json({ error: 'Campo não encontrado' }, { status: 404 })

    return NextResponse.json(serialize({ campo: rows[0] }))
  } catch (error) {
    console.error('GET /api/config/campos/[id]:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PUT — edita campo (nome, tipo, obrigatorio, opcoes, placeholder, ordem, ativo)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    // Verifica existência antes de aplicar update
    const existe = await prisma.$queryRaw`
      SELECT "id" FROM "SetorCampo"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId} LIMIT 1
    ` as any[]
    if (existe.length === 0) return NextResponse.json({ error: 'Campo não encontrado' }, { status: 404 })

    const body = await req.json()
    const { nome, tipo, obrigatorio, opcoes, placeholder, ordem, ativo } = body

    if (tipo !== undefined) {
      const tiposValidos = ['texto', 'numero', 'data', 'lista', 'checkbox', 'usuario', 'arquivo', 'cor']
      if (!tiposValidos.includes(tipo)) {
        return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
      }
    }

    // UPDATE por campo (padrão do projeto) — só atualiza o que veio no body
    if (nome !== undefined) {
      await prisma.$executeRaw`UPDATE "SetorCampo" SET "nome" = ${nome} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    }
    if (tipo !== undefined) {
      await prisma.$executeRaw`UPDATE "SetorCampo" SET "tipo" = ${tipo} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    }
    if (obrigatorio !== undefined) {
      await prisma.$executeRaw`UPDATE "SetorCampo" SET "obrigatorio" = ${Boolean(obrigatorio)} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    }
    if (opcoes !== undefined) {
      const opcoesJson = opcoes ? (typeof opcoes === 'string' ? opcoes : JSON.stringify(opcoes)) : null
      await prisma.$executeRaw`UPDATE "SetorCampo" SET "opcoes" = ${opcoesJson} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    }
    if (placeholder !== undefined) {
      await prisma.$executeRaw`UPDATE "SetorCampo" SET "placeholder" = ${placeholder || null} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    }
    if (ordem !== undefined) {
      await prisma.$executeRaw`UPDATE "SetorCampo" SET "ordem" = ${Number(ordem)} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    }
    if (ativo !== undefined) {
      await prisma.$executeRaw`UPDATE "SetorCampo" SET "ativo" = ${Boolean(ativo)} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    }

    const novos = await prisma.$queryRaw`
      SELECT "id", "setorId", "workspaceId", "nome", "tipo", "obrigatorio",
             "opcoes", "placeholder", "ordem", "ativo"
      FROM "SetorCampo"
      WHERE "id" = ${id}
    ` as any[]

    return NextResponse.json(serialize({ campo: novos[0] }))
  } catch (error) {
    console.error('PUT /api/config/campos/[id]:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE — remove campo permanentemente. Valores antigos em camposExtras dos pedidos
// viram lixo histórico (sem campo correspondente, a UI já não renderiza).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    const existe = await prisma.$queryRaw`
      SELECT "id" FROM "SetorCampo"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId} LIMIT 1
    ` as any[]
    if (existe.length === 0) return NextResponse.json({ error: 'Campo não encontrado' }, { status: 404 })

    await prisma.$executeRaw`
      DELETE FROM "SetorCampo"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/config/campos/[id]:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
