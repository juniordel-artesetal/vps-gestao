// Cron diário (9h de Brasília) — Método MAE: avisa por e-mail quem tem o TESTE terminando em até 2 dias (a 1ª
// cobrança vem no fim do teste). Idempotente: 1 aviso por assinatura (marca emailFimTrialEm).
// Autorizada por CRON_SECRET (Bearer, como a Vercel envia, ou ?secret=).
import { NextRequest, NextResponse } from 'next/server'
import { avisarFimDosTestesMae } from '@/lib/mae/assinatura/emails'
import { hojeSP } from '@/lib/mae/assinatura/precos'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const segredo = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || new URL(req.url).searchParams.get('secret')
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const r = await avisarFimDosTestesMae(hojeSP())
    console.log(`[CRON MAE] fim do teste: ${r.avisados}/${r.candidatos} avisados`)
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    console.error('[CRON MAE]', e)
    return NextResponse.json({ error: 'Erro no cron do Método Mãe' }, { status: 500 })
  }
}
