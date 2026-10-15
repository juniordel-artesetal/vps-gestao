// Cron ÚNICO — e-mail do LANÇAMENTO do Método Mãe: 16/10/2026 às 20h de Brasília (vercel.json "0 23 16 10 *", UTC).
// Todas as contas do SOA (ativas → SOA + Método Mãe; inativas → também "só o Método Mãe"). Idempotente por conta
// (AssinaturaAviso 'MAE_LANCAMENTO'); fora da janela 16/10 20h → 17/10 não envia (o agendamento é anual).
// Autorizada por CRON_SECRET (Bearer, como a Vercel envia, ou ?secret=). ?seco=1 só conta (nada é enviado).
// ?email= dispara só para essa conta (reenvio pontual, também só dentro da janela).
import { NextRequest, NextResponse } from 'next/server'
import { dispararEmailLancamento } from '@/lib/mae/assinatura/emailLancamento'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const segredo = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || url.searchParams.get('secret')
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const r = await dispararEmailLancamento({ seco: url.searchParams.get('seco') === '1', apenasEmail: url.searchParams.get('email') ?? undefined })
    return NextResponse.json({ ok: !r.erro, ...r })
  } catch (e) {
    console.error('[CRON MAE LANCAMENTO]', e)
    return NextResponse.json({ error: 'Erro no e-mail do lançamento do Método Mãe' }, { status: 500 })
  }
}
