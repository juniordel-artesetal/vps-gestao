// SOA Edition — fecha a reserva com o número de artes que saíram; o resto volta à cota/créditos.
import { NextRequest, NextResponse } from 'next/server'
import { ctxEstudio } from '@/lib/estudio/ctx'
import { fecharReserva, statusCota } from '@/lib/estudio/cota'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const b = await req.json().catch(() => ({}))
  if (typeof b.reservaId !== 'string' || !b.reservaId) return NextResponse.json({ error: 'Reserva inválida' }, { status: 400 })
  const r = await fecharReserva(c.workspaceId, c.userId, b.reservaId, Number(b.gerados) || 0)
  return NextResponse.json({ ...r, cota: await statusCota(c.workspaceId, c.userId) })
}
