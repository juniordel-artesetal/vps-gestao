import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (typeof obj === 'object' && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') {
    const r: any = {}
    for (const k of Object.keys(obj)) r[k] = serialize(obj[k])
    return r
  }
  return obj
}

function verificarMasterToken(req: NextRequest): boolean {
  const token = req.headers.get('x-master-token') || ''
  return token === process.env.MASTER_SECRET_TOKEN
}

// GET — detalhe com imagem
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verificarMasterToken(req))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  try {
    const [row] = await prisma.$queryRaw`
      SELECT
        sf.*, sf."usuarioNome" AS "userNome",
        sf.imagem AS "imagemBase64",
        (sf.imagem IS NOT NULL AND sf.imagem != '') AS "temImagem",
        w.nome AS "workspaceNome"
      FROM "SuporteFeedback" sf
      LEFT JOIN "Workspace" w ON w.id = sf."workspaceId"
      WHERE sf.id = ${id}
    ` as any[]

    if (!row) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    return NextResponse.json(serialize(row))
  } catch (err) {
    console.error('[GET /api/feedback/[id]]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PUT — atualizar status e/ou nota interna
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verificarMasterToken(req))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const { status, notaInterna } = await req.json()

  try {
    if (status !== undefined) {
      await prisma.$executeRaw`
        UPDATE "SuporteFeedback" SET "status" = ${status} WHERE id = ${id}
      `
    }
    if (notaInterna !== undefined) {
      await prisma.$executeRaw`
        UPDATE "SuporteFeedback" SET "notaInterna" = ${notaInterna} WHERE id = ${id}
      `
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PUT /api/feedback/[id]]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
