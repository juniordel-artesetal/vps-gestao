// Reordenar tarefas (drag-and-drop): recebe a nova ordem de ids e grava "ordem" = índice.
// Escopo por userId (só reordena as próprias). RAW, transacional.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const b = await req.json().catch(() => ({}))
  const ids = Array.isArray(b?.ids) ? b.ids.map(String).filter(Boolean) : []
  if (!ids.length) return NextResponse.json({ error: 'Lista vazia' }, { status: 400 })
  await prisma.$transaction(
    ids.map((id: string, i: number) =>
      prisma.$executeRaw`UPDATE "PessoalTarefa" SET "ordem" = ${i} WHERE "id" = ${id} AND "userId" = ${g.userId}`
    )
  )
  return NextResponse.json({ ok: true })
}
