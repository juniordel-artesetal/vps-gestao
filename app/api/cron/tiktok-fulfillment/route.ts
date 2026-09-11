// Cron — reenvia ao TikTok os fulfillments que ficaram 'pendente' (a chamada de escrita falhou
// na expedição, mas a expedição do SOA seguiu normal). Idempotente. Protegido por CRON_SECRET.
import { NextRequest, NextResponse } from 'next/server'
import { integracoesTecnicoAtivo } from '@/lib/marketplace/modulo'
import { retentarFulfillmentsPendentes } from '@/lib/tiktok/fulfillment'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handler(req: NextRequest) {
  const url = new URL(req.url)
  const segredo = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || url.searchParams.get('secret')
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  if (!integracoesTecnicoAtivo()) return NextResponse.json({ ok: true, skip: 'INTEGRACOES_ATIVO off' })
  const r = await retentarFulfillmentsPendentes()
  return NextResponse.json({ sucesso: true, ...r })
}

export const GET = handler
export const POST = handler
