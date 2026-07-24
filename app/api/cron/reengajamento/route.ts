// Rotina agendada de reengajamento (manhã, dias úteis — ver vercel.json).
// Autorizada por CRON_SECRET (header Authorization: Bearer, como a Vercel envia,
// ou ?secret=). Por padrão roda em DRY-RUN até REENGAJAMENTO_ATIVO=on (rollout
// responsável — calibrar volume/tom antes de enviar de verdade). ?dryRun=1 força.
import { NextRequest, NextResponse } from 'next/server'
import { executarReengajamento } from '@/lib/reengajamento'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handler(req: NextRequest) {
  const segredo = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || new URL(req.url).searchParams.get('secret')
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1' ? true : undefined
  const r = await executarReengajamento({ dryRun })
  return NextResponse.json(r)
}

export const GET = handler
export const POST = handler
