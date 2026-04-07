// app/api/feedback/[id]/route.ts
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
  return req.headers.get('x-master-token') === process.env.MASTER_SECRET_TOKEN
}

// GET — detalhe completo com imagem
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verificarMasterToken(req))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  const rows = await prisma.$queryRaw`
    SELECT
      sf.*,
      w.nome AS "workspaceNome"
    FROM "SuporteFeedback" sf
    LEFT JOIN "Workspace" w ON w.id = sf."workspaceId"
    WHERE sf.id = ${id}
  ` as any[]

  if (!rows.length) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  // Renomeia campos para o frontend
  const fb = rows[0]
  return NextResponse.json(serialize({
    ...fb,
    userNome:      fb.usuarioNome,
    imagemBase64:  fb.imagem || null,
    temImagem:     !!(fb.imagem),
  }))
}

// PUT — atualiza status e/ou nota interna
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verificarMasterToken(req))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id }  = await params
  const body    = await req.json()
  const status  = body.status      as string | undefined
  const nota    = body.notaInterna as string | undefined

  if (status !== undefined) {
    await prisma.$executeRaw`
      UPDATE "SuporteFeedback" SET "status" = ${status} WHERE id = ${id}
    `
  }
  if (nota !== undefined) {
    await prisma.$executeRaw`
      UPDATE "SuporteFeedback" SET "notaInterna" = ${nota} WHERE id = ${id}
    `
  }

  return NextResponse.json({ ok: true })
}
