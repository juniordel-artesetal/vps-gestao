import { NextRequest, NextResponse } from 'next/server'
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

// GET — retorna feedback completo incluindo imagemBase64
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isMaster(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id } = await params

  const rows = await prisma.$queryRaw`
    SELECT * FROM "Feedback" WHERE id = ${id}
  ` as any[]

  if (!rows.length) {
    return NextResponse.json({ error: 'Feedback não encontrado' }, { status: 404 })
  }

  return NextResponse.json(serialize(rows[0]))
}

// PUT — atualiza status e/ou nota interna (master only)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isMaster(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id } = await params
  const { status, notaInterna } = await req.json()

  const statusValidos = ['ABERTO', 'EM_ANALISE', 'CONCLUIDO', 'DESCARTADO']
  if (status && !statusValidos.includes(status)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
  }

  if (status && notaInterna !== undefined) {
    await prisma.$executeRaw`
      UPDATE "Feedback"
      SET status = ${status}, "notaInterna" = ${notaInterna}
      WHERE id = ${id}
    `
  } else if (status) {
    await prisma.$executeRaw`
      UPDATE "Feedback" SET status = ${status} WHERE id = ${id}
    `
  } else if (notaInterna !== undefined) {
    await prisma.$executeRaw`
      UPDATE "Feedback" SET "notaInterna" = ${notaInterna} WHERE id = ${id}
    `
  }

  return NextResponse.json({ ok: true })
}
