// app/api/financeiro/lancamentos/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

function parseDate(val: string | null | undefined): Date | null {
  if (!val) return null
  const s = String(val).trim()
  // DD/MM/AAAA
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (br) return new Date(`${br[3]}-${br[2].padStart(2,'0')}-${br[1].padStart(2,'0')}T12:00:00Z`)
  // AAAA-MM-DD
  if (s.match(/^\d{4}-\d{2}-\d{2}$/)) return new Date(s + 'T12:00:00Z')
  // ISO
  if (s.includes('T')) return new Date(s)
  return null
}

// GET — buscar lançamento por id
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId

  const rows = await prisma.$queryRaw`
    SELECT l.*, c.nome AS "categoriaNome", c.cor AS "categoriaCor", c.icone AS "categoriaIcone"
    FROM "FinLancamento" l
    LEFT JOIN "FinCategoria" c ON c.id = l."categoriaId"
    WHERE l.id = ${id} AND l."workspaceId" = ${workspaceId}
    LIMIT 1
  ` as any[]

  if (!rows.length) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json(serialize(rows[0]))
}

// PUT — editar lançamento
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId

  const body = await req.json()
  const {
    tipo, categoriaId, descricao, valor,
    data, canal, referencia, observacoes, status,
  } = body

  // Validações
  if (!descricao?.trim()) return NextResponse.json({ error: 'Descrição obrigatória' }, { status: 400 })
  if (!valor || isNaN(parseFloat(valor))) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })

  const dataConv = parseDate(data)
  if (!dataConv) return NextResponse.json({ error: 'Data inválida' }, { status: 400 })

  const valorNum  = parseFloat(String(valor))
  const tipoFinal = tipo || 'DESPESA'
  const statFinal = status || 'PENDENTE'

  await prisma.$executeRaw`
    UPDATE "FinLancamento"
    SET
      tipo          = ${tipoFinal},
      "categoriaId" = ${categoriaId || null},
      descricao     = ${descricao.trim()},
      valor         = ${valorNum},
      data          = ${dataConv},
      canal         = ${canal || null},
      referencia    = ${referencia || null},
      observacoes   = ${observacoes || null},
      status        = ${statFinal}
    WHERE id = ${id} AND "workspaceId" = ${workspaceId}
  `

  return NextResponse.json({ ok: true })
}

// DELETE — excluir lançamento
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId

  await prisma.$executeRaw`
    DELETE FROM "FinLancamento"
    WHERE id = ${id} AND "workspaceId" = ${workspaceId}
  `

  return NextResponse.json({ ok: true })
}
