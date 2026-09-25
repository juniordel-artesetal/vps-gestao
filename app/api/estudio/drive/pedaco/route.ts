// SOA Edition — plano B do envio ao Drive: repassa UM pedaço (≤ 4 MB, múltiplo de 256 KB) para a
// sessão resumable, quando o navegador não consegue falar direto com o Google. A URL da sessão
// só é aceita se for do endpoint de upload do Drive (sem SSRF).
import { NextRequest, NextResponse } from 'next/server'
import { ctxEstudio } from '@/lib/estudio/ctx'
import { sessaoDoDrive } from '@/lib/estudio/drive'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const sessao = req.headers.get('x-sessao')
  const faixa = req.headers.get('x-content-range')
  if (!sessaoDoDrive(sessao) || !faixa || !/^bytes \d+-\d+\/\d+$/.test(faixa)) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
  const corpo = new Uint8Array(await req.arrayBuffer())
  if (corpo.byteLength > 4.25 * 1024 * 1024) return NextResponse.json({ error: 'Pedaço grande demais' }, { status: 413 })
  const r = await fetch(sessao, { method: 'PUT', headers: { 'Content-Range': faixa }, body: corpo })
  if (r.status === 308) return NextResponse.json({ continuar: true, range: r.headers.get('range') })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) return NextResponse.json({ error: 'O Google recusou o pedaço.' }, { status: 502 })
  return NextResponse.json({ id: j.id ?? null })
}
