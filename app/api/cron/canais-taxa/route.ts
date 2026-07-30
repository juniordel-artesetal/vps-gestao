// Cron SEMANAL — monitora as taxas de Shopee/TikTok (fontes sem API) e alerta o Master.
// NÃO altera preço nem CatalogoCanal. Mercado Livre é tratado por /api/cron/ml-taxas.
import { NextRequest, NextResponse } from 'next/server'
import { verificarCanais } from '@/lib/canaisMonitor'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handler(req: NextRequest) {
  const url = new URL(req.url)
  const segredo = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || url.searchParams.get('secret')
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  // Enquanto CANAIS_MONITOR_ATIVO !== 'on', roda em modo verificação (não grava alerta).
  const ativo = process.env.CANAIS_MONITOR_ATIVO === 'on'
  const dryRun = url.searchParams.get('dryRun') === '1' || !ativo
  const simular = url.searchParams.get('simular')

  const r = await verificarCanais({ dryRun, simular })
  return NextResponse.json({ ok: true, ativo, ...r })
}

export const GET = handler
export const POST = handler
