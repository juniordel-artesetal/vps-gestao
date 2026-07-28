// A "inteligência" da campanha: descobre automaticamente quem já migrou.
//   assinouAsaas   = tem assinatura ATIVA no Asaas (por e-mail)
//   hotmartCancelada = NÃO tem mais assinatura ATIVA na Hotmart (por e-mail)
//   migrada = assinouAsaas AND hotmartCancelada → sai da régua
// Consultas READ-ONLY às APIs. Credenciais só em env. Nunca loga CPF (não usa).
import { chamarAsaas } from '@/lib/pagamento/asaas/client'
import { assinaturasPorEmail, credenciaisConfiguradas } from '@/lib/hotmart'

const ATIVO_HOTMART = 'ACTIVE'

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
  if (!credenciaisConfiguradas()) return null // sem credencial → não confirma (não marca migrada à toa)
  try {
    const subs = await assinaturasPorEmail(email)
    // Cancelada = não existe NENHUMA assinatura ATIVA para esse e-mail na Hotmart.
    return !subs.some(s => String(s.status).toUpperCase() === ATIVO_HOTMART)
  } catch (e) {
    console.error('[CAMPANHA-VALIDACAO] hotmart:', (e as Error)?.message)
    return null
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
