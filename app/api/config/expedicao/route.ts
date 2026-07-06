// app/api/config/expedicao/route.ts
// Config da consulta por leitura (QR/código de barras) da Expedição — por workspace.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
function novoId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }
function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}
const TIPOS = ['qr', 'barras', 'ambos']

// GET — config do workspace (default se não existir)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const [row] = await prisma.$queryRaw`
    SELECT "ativo", "campos", "campoDestaque", "tipoCodigo"
    FROM "ExpedicaoConfig" WHERE "workspaceId" = ${session.user.workspaceId} LIMIT 1
  ` as any[]
  if (!row) return NextResponse.json({ ativo: false, campos: [], campoDestaque: 'numero', tipoCodigo: 'ambos' })
  let campos: string[] = []
  try { campos = row.campos ? JSON.parse(row.campos) : [] } catch { campos = [] }
  return NextResponse.json(serialize({
    ativo: !!row.ativo, campos, campoDestaque: row.campoDestaque || 'numero',
    tipoCodigo: TIPOS.includes(row.tipoCodigo) ? row.tipoCodigo : 'ambos',
  }))
}

// PUT — upsert (só ADMIN/DELEGADOR alteram config)
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const ws = session.user.workspaceId
  const b = await req.json()
  const ativo = !!b.ativo
  const campos = Array.isArray(b.campos) ? JSON.stringify(b.campos.map((x: any) => String(x)).filter(Boolean)) : null
  const campoDestaque = b.campoDestaque ? String(b.campoDestaque) : 'numero'
  const tipoCodigo = TIPOS.includes(b.tipoCodigo) ? b.tipoCodigo : 'ambos'

  const [existe] = await prisma.$queryRaw`SELECT "id" FROM "ExpedicaoConfig" WHERE "workspaceId" = ${ws} LIMIT 1` as any[]
  if (existe) {
    await prisma.$executeRaw`
      UPDATE "ExpedicaoConfig"
      SET "ativo" = ${ativo}, "campos" = ${campos}, "campoDestaque" = ${campoDestaque},
          "tipoCodigo" = ${tipoCodigo}, "updatedAt" = NOW()
      WHERE "id" = ${existe.id} AND "workspaceId" = ${ws}
    `
  } else {
    await prisma.$executeRaw`
      INSERT INTO "ExpedicaoConfig" ("id","workspaceId","ativo","campos","campoDestaque","tipoCodigo","createdAt","updatedAt")
      VALUES (${novoId()}, ${ws}, ${ativo}, ${campos}, ${campoDestaque}, ${tipoCodigo}, NOW(), NOW())
    `
  }
  return NextResponse.json({ ok: true })
}
