// Cron — renova os tokens do TikTok Shop ANTES de expirar (o refresh_token do TikTok
// também vence; sem uso a conexão morreria). Percorre as conexões ativas e chama
// getAccessTokenValido, que renova sozinho quando está perto de expirar. Idempotente e
// barato. Protegido por CRON_SECRET (mesmo padrão dos demais crons).
import { NextRequest, NextResponse } from 'next/server'
import { integracoesAtivo, conexoesAtivas, getAccessTokenValido } from '@/lib/tiktok/conta'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handler(req: NextRequest) {
  const url = new URL(req.url)
  const segredo = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || url.searchParams.get('secret')
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  if (!integracoesAtivo()) return NextResponse.json({ ok: true, skip: 'INTEGRACOES_ATIVO off' })

  const ids = await conexoesAtivas()
  let renovados = 0, falhas = 0
  for (const ws of ids) {
    try { (await getAccessTokenValido(ws)) ? renovados++ : falhas++ }
    catch { falhas++ }
  }
  return NextResponse.json({ ok: true, conexoes: ids.length, renovados, falhas })
}

export const GET = handler
export const POST = handler
