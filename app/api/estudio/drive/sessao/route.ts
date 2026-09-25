// SOA Edition — abre o envio resumable no Drive DELA; o navegador sobe o arquivo direto ao Google.
import { NextRequest, NextResponse } from 'next/server'
import { ctxEstudio } from '@/lib/estudio/ctx'
import { abrirSessaoUpload } from '@/lib/estudio/drive'

export const dynamic = 'force-dynamic'
const MAX_DRIVE = 2 * 1024 * 1024 * 1024 // 2 GB por arquivo

export async function POST(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const b = await req.json().catch(() => ({}))
  const tamanho = Math.floor(Number(b.tamanho) || 0)
  if (!b.nome || tamanho < 1) return NextResponse.json({ error: 'Arquivo inválido' }, { status: 400 })
  if (tamanho > MAX_DRIVE) return NextResponse.json({ error: 'Arquivo acima de 2 GB.' }, { status: 400 })
  const r = await abrirSessaoUpload(c.workspaceId, c.userId, { nome: String(b.nome), mime: String(b.mime || ''), tamanho }, new URL(req.url).origin)
  if (!r.ok) return NextResponse.json({ error: r.erro, desconectado: r.desconectado ?? false }, { status: r.desconectado ? 409 : 502 })
  return NextResponse.json({ uploadUrl: r.uploadUrl })
}
