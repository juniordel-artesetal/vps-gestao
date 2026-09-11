// Cron de RECONCILIAÇÃO dos marketplaces (rede de segurança; o webhook é o tempo real).
// Varre só as lojas CONECTADAS, incremental e idempotente (upsert por idExterno). Falha numa
// loja não derruba as outras. Protegido por CRON_SECRET. Intervalo configurável na vercel.json.
import { NextRequest, NextResponse } from 'next/server'
import { integracoesTecnicoAtivo } from '@/lib/marketplace/modulo'
import { conexoesAtivas } from '@/lib/tiktok/conta'
import { sincronizarPedidosTikTok } from '@/lib/tiktok/pedidos'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handler(req: NextRequest) {
  const url = new URL(req.url)
  const segredo = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || url.searchParams.get('secret')
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  if (!integracoesTecnicoAtivo()) return NextResponse.json({ ok: true, skip: 'INTEGRACOES_ATIVO off' })

  const ids = await conexoesAtivas() // só lojas TikTok conectadas
  const limite = Math.min(Math.max(Number(url.searchParams.get('limite')) || 30, 1), 100)
  let lojas = 0, importados = 0, falhas = 0
  for (const ws of ids) {
    try {
      const r = await sincronizarPedidosTikTok(ws, { limite })
      lojas++; if (r.ok) importados += r.importados
    } catch (e) { falhas++; console.error('[cron marketplace-sync] loja', ws, (e as Error)?.message) }
  }
  return NextResponse.json({ ok: true, lojas, importados, falhas })
}

export const GET = handler
export const POST = handler
