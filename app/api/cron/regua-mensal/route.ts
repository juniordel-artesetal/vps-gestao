// Cron diário (9h de Brasília) — RÉGUA DAS MENSALIDADES (ver lib/cobranca/reguaMensal.ts): lembretes antes do
// vencimento, cobrança em atraso, bloqueio depois de 3 dias, para SOA, Método Mãe, Pessoal e Marketplaces.
// Autorizada por CRON_SECRET (Bearer, como a Vercel envia, ou ?secret=). ?seco=1 só calcula (nada é enviado nem
// bloqueado) e devolve a prévia. Desligar: REGUA_MENSAL=off.
import { NextRequest, NextResponse } from 'next/server'
import { rodarReguaMensal } from '@/lib/cobranca/reguaMensal'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const segredo = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || url.searchParams.get('secret')
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    return NextResponse.json({ ok: true, ...(await rodarReguaMensal({ seco: url.searchParams.get('seco') === '1' })) })
  } catch (e) {
    console.error('[CRON REGUA MENSAL]', e)
    return NextResponse.json({ error: 'Erro na régua das mensalidades' }, { status: 500 })
  }
}
