// A "inteligência" da campanha: descobre automaticamente quem já migrou.
//   assinouAsaas   = tem assinatura ATIVA no Asaas (por e-mail)
//   hotmartCancelada = NÃO tem mais assinatura ATIVA na Hotmart (por e-mail)
//   migrada = assinouAsaas AND hotmartCancelada → sai da régua
// Consultas READ-ONLY às APIs. Credenciais só em env. Nunca loga CPF (não usa).
import { prisma } from '@/lib/prisma'
import { chamarAsaas } from '@/lib/pagamento/asaas/client'
import { assinaturasPorEmail, credenciaisConfiguradas } from '@/lib/hotmart'

const ATIVO_HOTMART = 'ACTIVE'
// Eventos do webhook que indicam encerramento na Hotmart.
const EVENTOS_CANCELA = ['SUBSCRIPTION_CANCELLATION', 'PURCHASE_CANCELED', 'PURCHASE_REFUNDED', 'PURCHASE_EXPIRED', 'PURCHASE_PROTEST']
const EVENTOS_ATIVA = ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE']

// Fallback SEM a API Hotmart (credenciais ausentes em prod): usa o WEBHOOK já recebido.
// Cancelada = existe evento de cancelamento POSTERIOR à última cobrança aprovada (alta confiança).
// Retorna null quando não há histórico Hotmart (não dá pra afirmar → não marca migrada à toa).
async function hotmartCanceladaPorWebhook(email: string): Promise<boolean | null> {
  try {
    const [r] = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS n,
             MAX(CASE WHEN "evento" = ANY(${EVENTOS_ATIVA}::text[])   THEN "createdAt" END) AS aprov,
             MAX(CASE WHEN "evento" = ANY(${EVENTOS_CANCELA}::text[]) THEN "createdAt" END) AS cancel
      FROM "HotmartEvent" WHERE lower("email") = ${email.toLowerCase()}
    ` as { n: number; aprov: Date | null; cancel: Date | null }[]
    if (!r || Number(r.n) === 0) return null
    if (r.cancel && (!r.aprov || r.cancel > r.aprov)) return true
    return false
  } catch (e) { console.error('[CAMPANHA-VALIDACAO] webhook:', (e as Error)?.message); return null }
}

export interface EstadoMigracao {
  assinouAsaas: boolean
  hotmartCancelada: boolean | null // null = não deu pra confirmar (sem credencial)
  migrada: boolean
}

async function asaasTemAssinaturaAtiva(email: string): Promise<boolean> {
  const cust = await chamarAsaas<{ data?: { id?: string }[] }>(`/customers?email=${encodeURIComponent(email)}`, { exigirAtivo: false })
  const ids = (cust.dados?.data ?? []).map(c => c.id).filter(Boolean) as string[]
  for (const id of ids) {
    const subs = await chamarAsaas<{ data?: { status?: string }[] }>(`/subscriptions?customer=${id}`, { exigirAtivo: false })
    if ((subs.dados?.data ?? []).some(s => String(s.status).toUpperCase() === 'ACTIVE')) return true
  }
  return false
}

async function hotmartSemAtiva(email: string): Promise<boolean | null> {
  // Sem credencial de API → usa o WEBHOOK (fonte que a Hotmart já manda pra cá). Antes
  // retornava null e ninguém saía da régua ao cancelar — era o bug da "cutucada à toa".
  if (!credenciaisConfiguradas()) return hotmartCanceladaPorWebhook(email)
  try {
    const subs = await assinaturasPorEmail(email)
    // Cancelada = não existe NENHUMA assinatura ATIVA para esse e-mail na Hotmart.
    return !subs.some(s => String(s.status).toUpperCase() === ATIVO_HOTMART)
  } catch (e) {
    console.error('[CAMPANHA-VALIDACAO] hotmart:', (e as Error)?.message)
    return hotmartCanceladaPorWebhook(email) // API falhou → tenta o webhook antes de desistir
  }
}

export async function verificarMigracao(email: string): Promise<EstadoMigracao> {
  const [assinouAsaas, hotmartCancelada] = await Promise.all([
    asaasTemAssinaturaAtiva(email).catch(() => false),
    hotmartSemAtiva(email),
  ])
  return { assinouAsaas, hotmartCancelada, migrada: assinouAsaas && hotmartCancelada === true }
}

/** Deriva o estado da campanha a partir da verificação. */
export function estadoDerivado(v: EstadoMigracao): 'migrada' | 'assinou_asaas' | 'cancelou_hotmart' | 'pendente' {
  if (v.migrada) return 'migrada'
  if (v.assinouAsaas) return 'assinou_asaas'   // falta cancelar Hotmart
  if (v.hotmartCancelada === true) return 'cancelou_hotmart' // falta assinar Asaas
  return 'pendente'
}
