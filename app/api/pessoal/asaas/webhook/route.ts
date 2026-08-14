// Webhook Asaas do módulo PESSOAL. Chamada externa (sem sessão): a auth é o header
// `asaas-access-token` = ASAAS_(SANDBOX_)WEBHOOK_TOKEN. Só age em assinaturas do Pessoal
// (casadas por subscriptionId); eventos de outra coisa são ignorados sem erro.
// Sempre responde 200 após validar (o Asaas para a fila com 15 não-2xx seguidos).
// 🔒 Nunca loga CPF/nome/e-mail/cartão — só evento + subscriptionId.
import { NextRequest, NextResponse } from 'next/server'
import { credsPessoal } from '@/lib/pessoal/asaas'
import { aplicarEventoPessoal, ehExternalRefPessoal } from '@/lib/pessoal/assinatura'
import { alertarErro } from '@/lib/alert'

export const dynamic = 'force-dynamic'

// Health-check do endpoint (o Asaas usa POST; este GET é só pra confirmar que a rota
// está no ar). Reporta se o token de webhook está configurado — sem revelar o valor.
export async function GET() {
  const cred = await credsPessoal()
  return NextResponse.json({
    ok: true,
    service: 'pessoal-asaas-webhook',
    ambiente: cred.sandbox ? 'sandbox' : 'producao',
    temWebhookToken: !!cred.webhookToken,
  })
}

export async function POST(req: NextRequest) {
  // 1) Autenticidade — fail closed, antes de ler o corpo.
  const cred = await credsPessoal()
  const token = req.headers.get('asaas-access-token')
  if (!cred.webhookToken || token !== cred.webhookToken) {
    console.warn('[PESSOAL-WH] token inválido ou ausente')
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null) as {
    event?: string
    payment?: { subscription?: string; dueDate?: string; externalReference?: string }
    subscription?: { id?: string }
  } | null
  const evento = body?.event
  if (!evento) return NextResponse.json({ ok: true, ignorado: 'sem event' })

  const subscriptionId = body?.payment?.subscription || body?.subscription?.id || null
  const dueDate = body?.payment?.dueDate || null
  const extRef = body?.payment?.externalReference || null
  const ehPagamento = evento === 'PAYMENT_CONFIRMED' || evento === 'PAYMENT_RECEIVED'

  try {
    const casou = await aplicarEventoPessoal(evento, subscriptionId, dueDate)
    // REDE DE SEGURANÇA (imediata): pagamento marcado como do Pessoal que NÃO casou com
    // nenhuma assinatura → alguém pagou e não foi ativado. Alerta na hora (Telegram).
    if (ehPagamento && ehExternalRefPessoal(extRef) && !casou) {
      await alertarErro('[PESSOAL] pagamento confirmado sem assinatura casada',
        `evento=${evento} sub=${subscriptionId ?? '-'} ref=${extRef}`).catch(() => {})
    }
    console.log(`[PESSOAL-WH] evento=${evento} sub=${subscriptionId ?? '-'} casou=${casou}`)
    return NextResponse.json({ ok: true, aplicado: casou })
  } catch (e) {
    // Erro de processamento nunca vira não-2xx (não travar a fila do Asaas).
    console.error('[PESSOAL-WH] falha:', (e as Error)?.message)
    await alertarErro('[PESSOAL] erro ao processar webhook', (e as Error)?.message).catch(() => {})
    return NextResponse.json({ ok: true, processado: false })
  }
}
