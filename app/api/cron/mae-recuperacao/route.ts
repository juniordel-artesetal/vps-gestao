// Cron de hora em hora — RECUPERAÇÃO DE VENDAS do Método Mãe (ver lib/mae/assinatura/recuperacao.ts): quem começou a
// comprar e não terminou recebe 3 e-mails (1 h, 24 h, 72 h). Autorizada por CRON_SECRET (Bearer, como a Vercel envia,
// ou ?secret=). ?seco=1 só conta, nada é enviado. Desligar: MAE_RECUPERACAO=off.
import { NextRequest, NextResponse } from 'next/server'
import { rodarRecuperacaoMae } from '@/lib/mae/assinatura/recuperacao'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const segredo = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || url.searchParams.get('secret')
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    return NextResponse.json({ ok: true, ...(await rodarRecuperacaoMae({ seco: url.searchParams.get('seco') === '1' })) })
  } catch (e) {
    console.error('[CRON MAE RECUPERACAO]', e)
    return NextResponse.json({ error: 'Erro na recuperação de vendas do Método Mãe' }, { status: 500 })
  }
}
