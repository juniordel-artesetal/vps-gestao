// Link "Pagar agora" dos e-mails da régua das mensalidades: fica no domínio do SOA e leva à fatura do Asaas.
// /api/cobranca/fatura?p=<cobrança>&t=<assinatura HMAC> — sem a assinatura certa, não abre nada. Se a cobrança já foi
// paga (ou não existe mais), leva à página da assinatura em vez da fatura.
import { NextRequest, NextResponse } from 'next/server'
import { chamarAsaas } from '@/lib/pagamento/asaas/client'
import { tokenFaturaValido } from '@/lib/cobranca/reguaMensal'
import { URL_SOA } from '@/lib/baseUrl'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const p = url.searchParams.get('p') ?? '', t = url.searchParams.get('t') ?? ''
  if (!/^pay_[A-Za-z0-9]+$/.test(p) || !tokenFaturaValido(p, t)) return NextResponse.redirect(`${URL_SOA}/assinatura`)
  const r = await chamarAsaas<{ status?: string; invoiceUrl?: string; deleted?: boolean }>(`/payments/${p}`)
  const aberta = r.ok && !r.dados?.deleted && ['PENDING', 'OVERDUE'].includes(r.dados?.status ?? '')
  if (aberta && r.dados?.invoiceUrl?.startsWith('https://')) return NextResponse.redirect(r.dados.invoiceUrl)
  return NextResponse.redirect(`${URL_SOA}/assinatura${r.ok && !aberta ? '?pago=1' : ''}`)
}
