// Cron SEMANAL — atualiza as taxas do Mercado Livre pela API oficial (Listing Prices)
// e reescreve o registro 'mercadolivre' do CatalogoCanal (fonte única da precificação).
// Sem ML_ACCESS_TOKEN → fallback: mantém o catálogo atual e avisa (não quebra).
import { NextRequest, NextResponse } from 'next/server'
import { refreshMLTaxas } from '@/lib/mlTaxas'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handler(req: NextRequest) {
  const url = new URL(req.url)
  const segredo = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || url.searchParams.get('secret')
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const dryRun = url.searchParams.get('dryRun') === '1'
  const r = await refreshMLTaxas({ dryRun })
  return NextResponse.json(r)
}

export const GET = handler
export const POST = handler
