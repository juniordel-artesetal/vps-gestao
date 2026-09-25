// SOA Edition — AUTORIZA (e debita) a próxima leva de artes de um lote. O servidor é a autoridade:
// confere o saldo no banco, debita na hora e é idempotente pela chave (reenvio não debita de novo).
// Sem saldo → 402 com quanto falta (a tela oferece o pacote de 50).
import { NextRequest, NextResponse } from 'next/server'
import { ctxEstudio } from '@/lib/estudio/ctx'
import { autorizarItens, MAX_POR_AUTORIZACAO } from '@/lib/estudio/cota'

export const dynamic = 'force-dynamic'
const ID = /^[a-z0-9]{8,40}$/
const CHAVE = /^[a-z0-9]{8,40}:\d{1,4}$/

export async function POST(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const b = await req.json().catch(() => ({}))
  const lote = String(b.lote || ''), chave = String(b.chave || '')
  const qtd = Math.floor(Number(b.quantidade) || 0)
  if (!ID.test(lote) || !CHAVE.test(chave) || !chave.startsWith(lote + ':')) return NextResponse.json({ error: 'Autorização inválida' }, { status: 400 })
  if (qtd < 1 || qtd > MAX_POR_AUTORIZACAO) return NextResponse.json({ error: 'Quantidade inválida' }, { status: 400 })
  const r = await autorizarItens(c.workspaceId, c.userId, lote, chave, qtd)
  if (!r.ok) {
    return NextResponse.json({
      error: `Suas imagens de hoje acabaram (faltam ${r.faltam}). Compre um pacote de ${r.status.imagensPorPacote} ou continue amanhã.`,
      faltam: r.faltam, cota: r.status,
    }, { status: 402 })
  }
  return NextResponse.json({ autorizados: r.autorizados, repetida: r.repetida, cota: r.status })
}
