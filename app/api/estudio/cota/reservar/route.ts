// SOA Edition — reserva a cota ANTES de gerar um lote. Sem saldo → 402 com quanto falta
// (a tela oferece comprar pacote). Teto por execução: LIMITE_LOTE.
import { NextRequest, NextResponse } from 'next/server'
import { ctxEstudio } from '@/lib/estudio/ctx'
import { reservarCota } from '@/lib/estudio/cota'
import { LIMITE_LOTE } from '@/lib/estudio/dados'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const b = await req.json().catch(() => ({}))
  const qtd = Math.floor(Number(b.quantidade) || 0)
  if (qtd < 1) return NextResponse.json({ error: 'Quantidade inválida' }, { status: 400 })
  if (qtd > LIMITE_LOTE) return NextResponse.json({ error: `Máximo de ${LIMITE_LOTE} artes por vez — gere em levas.` }, { status: 400 })
  const r = await reservarCota(c.workspaceId, c.userId, qtd)
  if (!r.ok) {
    return NextResponse.json({
      error: `Você tem ${r.status.disponivel} imagem(ns) disponível(is) e o lote pede ${qtd}.`,
      faltam: r.faltam, cota: r.status,
    }, { status: 402 })
  }
  return NextResponse.json({ reservaId: r.reservaId, cota: r.status })
}
