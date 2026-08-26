// Cron — rede de segurança contra corte errado de pagante Hotmart. Reativa quem está
// ativo=false mas tem aprovação Hotmart recente (últ. evento bom). Autorizado por CRON_SECRET
// (Bearer, como a Vercel envia, ou ?secret=). ?dryRun=1 lista sem gravar. Agendar 1x/dia.
import { NextRequest, NextResponse } from 'next/server'
import { recuperarPagantesHotmart } from '@/lib/hotmart/recuperacao'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const segredo = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || new URL(req.url).searchParams.get('secret')
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1'
  try {
    const r = await recuperarPagantesHotmart({ dryRun })
    return NextResponse.json({ ok: true, dryRun, ...r })
  } catch (e: any) {
    console.error('[CRON reconciliar-hotmart]', e?.message)
    return NextResponse.json({ error: 'Erro ao reconciliar' }, { status: 500 })
  }
}
