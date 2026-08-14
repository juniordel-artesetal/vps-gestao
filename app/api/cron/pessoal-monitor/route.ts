// Cron — REDE DE SEGURANÇA do add-on Pessoal (backstop do webhook).
// Pega assinaturas PENDENTE há mais de N minutos, consulta o Asaas: se a cobrança já foi
// PAGA e o status local não virou ATIVA, o webhook falhou → REPARA (ativa) + ALERTA.
// Autorizada por CRON_SECRET (Bearer, como a Vercel envia, ou ?secret=).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensurePessoalTables } from '@/lib/pessoal/schema'
import { chamarAsaasPessoal } from '@/lib/pessoal/asaas'
import { aplicarEventoPessoal } from '@/lib/pessoal/assinatura'
import { alertarErro } from '@/lib/alert'

export const dynamic = 'force-dynamic'

const MIN_ESPERA = 15   // minutos que damos ao webhook antes de suspeitar
const PAGOS = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'])

export async function GET(req: NextRequest) {
  const segredo = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || new URL(req.url).searchParams.get('secret')
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  await ensurePessoalTables()

  const pendentes = await prisma.$queryRaw`
    SELECT "asaasSubscriptionId" AS sub, "userId"
    FROM "PessoalAssinatura"
    WHERE "status" = 'PENDENTE' AND "asaasSubscriptionId" IS NOT NULL
      AND "createdAt" < NOW() - (${MIN_ESPERA} || ' minutes')::interval
    LIMIT 50
  ` as { sub: string; userId: string }[]

  let reparados = 0, aindaPendente = 0
  for (const p of pendentes) {
    const r = await chamarAsaasPessoal<{ data?: { status?: string; dueDate?: string }[] }>(`/subscriptions/${p.sub}/payments?limit=5`)
    const pago = r.ok && (r.dados?.data || []).find(c => PAGOS.has(c.status || ''))
    if (pago) {
      // Webhook não ativou apesar do pagamento → repara + alerta (1º cliente que falhar é pego).
      await aplicarEventoPessoal('PAYMENT_CONFIRMED', p.sub, pago.dueDate || null)
      await alertarErro('[PESSOAL] pagamento pago mas status ficou PENDENTE — reparado pelo cron', `sub=${p.sub}`).catch(() => {})
      reparados++
    } else {
      aindaPendente++
    }
  }

  return NextResponse.json({ ok: true, verificados: pendentes.length, reparados, aindaPendente })
}
