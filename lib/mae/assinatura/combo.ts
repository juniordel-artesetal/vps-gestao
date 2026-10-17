// PACOTE SOA + MÉTODO MÃE numa COBRANÇA ÚNICA (16/10/2026, correção do Júnior): quem ainda não paga o SOA e clica em
// "SOA + Método Mãe" assina AS DUAS soluções de uma vez, num item só — R$ 89,80/mês (SOA R$ 49,90 + MAE R$ 39,90) ou
// R$ 753/ano (SOA R$ 370 + MAE R$ 383; à vista no Pix/cartão ou até 12× com juros). Quem já PAGA o SOA continua no
// MAE à parte (R$ 39,90), porque o SOA dela já é cobrado. Puro (preços e nomes); o checkout fica em servidor.ts.
import { calcularParcelamentoAnual, MAX_PARCELAS_ANUAL, precoMensalVigente, anualAvistaVigente, type Parcelamento } from '@/lib/assinatura/planos'
import type { PrecosMae, CicloMae } from './precos'

/** Plano gravado em MaeAssinatura.plano para o pacote (o acesso do MAE é o de quem tem o SOA: "addon"). */
export const PLANO_COMBO = 'combo'
const r2 = (v: number) => Math.round(v * 100) / 100

export function precoCombo(p: PrecosMae, agora: Date = new Date()): { mensal: number; anual: number } {
  return { mensal: r2(precoMensalVigente(agora) + p.addon.mensal), anual: r2(anualAvistaVigente(agora) + p.addon.anual) }
}
export function cobrancaCombo(p: PrecosMae, ciclo: CicloMae, parcelas = 1, agora: Date = new Date()): Parcelamento {
  const c = precoCombo(p, agora)
  if (ciclo === 'mensal') return { parcelas: 1, valorParcela: c.mensal, total: c.mensal }
  return calcularParcelamentoAnual(Math.max(1, Math.min(MAX_PARCELAS_ANUAL, Math.floor(parcelas) || 1)), c.anual)
}
/** Quem já PAGA o SOA hoje (assinatura ativa no Asaas/Hotmart ou liberação manual). Puro. */
export const jaPagaSoa = (w: { assinaturaStatus: string | null; liberacaoManual: boolean | null }) => w.assinaturaStatus === 'ATIVA' || !!w.liberacaoManual
/**
 * O SOA desta conta pode entrar no PACOTE (uma cobrança só)? Sim, a não ser que o SOA dela seja cobrado FORA daqui:
 * Hotmart ativa (não dá para cancelar aquela cobrança daqui) ou liberação manual do Master. Assinante do Asaas entra no
 * pacote e a assinatura antiga do SOA é encerrada quando o pacote é pago (16/10/2026: "o preço clicado é o cobrado"). Puro.
 */
export const podeEntrarNoPacote = (w: { assinaturaStatus: string | null; assinaturaOrigem?: string | null; liberacaoManual: boolean | null }) =>
  !w.liberacaoManual && !(w.assinaturaStatus === 'ATIVA' && w.assinaturaOrigem === 'hotmart')

export const nomeDoItemCombo = (ciclo: CicloMae) => `SOA + Método Mãe · ${ciclo}`.slice(0, 30)
const brlTxt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ')
export function descricaoDoItemCombo(ciclo: CicloMae, c: { parcelas: number; valorParcela: number; total: number }): string {
  const preco = ciclo === 'mensal' ? `${brlTxt(c.total)}/mês, numa cobrança só. Cancele quando quiser.`
    : c.parcelas > 1 ? `1 ano em ${c.parcelas}x de ${brlTxt(c.valorParcela)} (total ${brlTxt(c.total)} c/ juros). Escolha ${c.parcelas}x no parcelamento.`
      : `1 ano por ${brlTxt(c.total)} à vista, no Pix ou no cartão.`
  return `SOA completo + Método Mãe: ${preco}`.slice(0, 150)
}
