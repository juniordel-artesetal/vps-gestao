// Cron ÚNICO — e-mail "começa agora" da LIVE de lançamento do Método Mãe: 16/10/2026 às 19h58 de Brasília
// (vercel.json "58 22 16 10 *", UTC). Todas as contas, ativas e inativas (lib/mae/assinatura/emailLive.ts).
// Idempotente por conta; fora da janela 19h50 → 21h de 16/10/2026 não envia. CRON_SECRET (Bearer ou ?secret=).
// ?seco=1 só conta.
import { NextRequest, NextResponse } from 'next/server'
import { dispararEmailLive } from '@/lib/mae/assinatura/emailLive'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const segredo = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || url.searchParams.get('secret')
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const r = await dispararEmailLive({ seco: url.searchParams.get('seco') === '1' })
    return NextResponse.json({ ok: !r.erro, ...r })
  } catch (e) {
    console.error('[CRON MAE LIVE]', e)
    return NextResponse.json({ error: 'Erro no e-mail da live do Método Mãe' }, { status: 500 })
  }
}
