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

function isMaster(req: NextRequest) {
  return req.headers.get('x-master-token') === process.env.MASTER_SECRET_TOKEN
}

// GET — master only — lista feedbacks sem a imagem (performance)
export async function GET(req: NextRequest) {
  if (!isMaster(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const tipo   = searchParams.get('tipo')   || ''
  const status = searchParams.get('status') || ''

  const tiposValidos  = ['BUG', 'MELHORIA', 'SUGESTAO']
  const statusValidos = ['ABERTO', 'EM_ANALISE', 'CONCLUIDO', 'DESCARTADO']

  const tipoFlt   = tiposValidos.includes(tipo)   ? tipo   : ''
  const statusFlt = statusValidos.includes(status) ? status : ''

  let rows: any[]

  if (tipoFlt && statusFlt) {
    rows = await prisma.$queryRaw`
      SELECT
        id, "workspaceId", "workspaceNome", "userId", "userNome",
        tipo, titulo, descricao,
        CASE WHEN "imagemBase64" IS NOT NULL THEN true ELSE false END AS "temImagem",
        status, "notaInterna", "createdAt"
      FROM "Feedback"
      WHERE tipo = ${tipoFlt} AND status = ${statusFlt}
      ORDER BY "createdAt" DESC
      LIMIT 300
    ` as any[]
  } else if (tipoFlt) {
    rows = await prisma.$queryRaw`
      SELECT
        id, "workspaceId", "workspaceNome", "userId", "userNome",
        tipo, titulo, descricao,
        CASE WHEN "imagemBase64" IS NOT NULL THEN true ELSE false END AS "temImagem",
        status, "notaInterna", "createdAt"
      FROM "Feedback"
      WHERE tipo = ${tipoFlt}
      ORDER BY "createdAt" DESC
      LIMIT 300
    ` as any[]
  } else if (statusFlt) {
    rows = await prisma.$queryRaw`
      SELECT
        id, "workspaceId", "workspaceNome", "userId", "userNome",
        tipo, titulo, descricao,
        CASE WHEN "imagemBase64" IS NOT NULL THEN true ELSE false END AS "temImagem",
        status, "notaInterna", "createdAt"
      FROM "Feedback"
      WHERE status = ${statusFlt}
      ORDER BY "createdAt" DESC
      LIMIT 300
    ` as any[]
  } else {
    rows = await prisma.$queryRaw`
      SELECT
        id, "workspaceId", "workspaceNome", "userId", "userNome",
        tipo, titulo, descricao,
        CASE WHEN "imagemBase64" IS NOT NULL THEN true ELSE false END AS "temImagem",
        status, "notaInterna", "createdAt"
      FROM "Feedback"
      ORDER BY "createdAt" DESC
      LIMIT 300
    ` as any[]
  }

  return NextResponse.json(serialize(rows))
}

// POST — usuário autenticado envia feedback
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await req.json()
  const { tipo, titulo, descricao, imagemBase64 } = body

  const tiposValidos = ['BUG', 'MELHORIA', 'SUGESTAO']
  if (!tiposValidos.includes(tipo)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }
  if (!titulo?.trim() || !descricao?.trim()) {
    return NextResponse.json({ error: 'Título e descrição são obrigatórios' }, { status: 400 })
  }

  const id            = Math.random().toString(36).slice(2) + Date.now().toString(36)
  const workspaceId   = (session.user as any).workspaceId   || ''
  const workspaceNome = (session.user as any).workspaceNome || ''
  const userId        = (session.user as any).id            || ''
  const userNome      = session.user.name                   || ''

  await prisma.$executeRaw`
    INSERT INTO "Feedback"
      ("id", "workspaceId", "workspaceNome", "userId", "userNome",
       "tipo", "titulo", "descricao", "imagemBase64", "status", "createdAt")
    VALUES
      (${id}, ${workspaceId}, ${workspaceNome}, ${userId}, ${userNome},
       ${tipo}, ${titulo.trim()}, ${descricao.trim()}, ${imagemBase64 ?? null}, 'ABERTO', NOW())
  `

  return NextResponse.json({ ok: true, id })
}
