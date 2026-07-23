// Resolução do split de comissão de uma indicada, para injetar na CRIAÇÃO da
// cobrança/checkout. Espelha o caminho já provado do /assinar (parceiroDoWorkspace
// → percentualDoPlano → montarSplitComissao), num único lugar reutilizável — Pix,
// checkout e futuras renovações resolvem igual.
//
// Vive em lib/parceiras (camada de negócio) porque cruza parceiroDoWorkspace
// (lib/assinatura) com montarSplitComissao (adapter Asaas) — o adapter não deve
// depender do negócio.
import type { SplitItem } from '@/lib/pagamento/asaas/tipos'
import { montarSplitComissao } from '@/lib/pagamento/asaas'
import { parceiroDoWorkspace } from '@/lib/assinatura/parceiro'
import { percentualDoPlano, type Plano, type FormaPagamento } from '@/lib/assinatura/planos'
import { parceirasAtivo } from './atribuicao'

export interface SplitResolvido {
  /** Para injetar no corpo do Asaas (vazio = sem split a aplicar). */
  split: SplitItem[]
  /** Snapshot para persistir (AsaasCobranca / AsaasAssinatura). */
  parceiroId: string | null
  splitWalletId: string | null
  splitValor: number | null
  splitPercentual: number | null
  /** Causa da recusa do split (guarda de estouro), para o accrual distinguir. */
  splitErro: string | null
}

const VAZIO: SplitResolvido = {
  split: [], parceiroId: null, splitWalletId: null, splitValor: null, splitPercentual: null, splitErro: null,
}

/**
 * Resolve o split da indicada para um plano. Nunca lança: split é consequência da
 * cobrança, não pré-requisito — falha aqui devolve VAZIO e a receita segue.
 */
export async function resolverSplitParceira(
  workspaceId: string,
  plano: Plano,
  valorCobrado: number,
  forma: FormaPagamento,
): Promise<SplitResolvido> {
  if (!parceirasAtivo()) return VAZIO
  try {
    const parceiro = await parceiroDoWorkspace(workspaceId)
    if (!parceiro) return VAZIO

    const perc = percentualDoPlano(plano, parceiro)
    // Comissão sobre o BRUTO do plano (regra do SOA), como no /assinar.
    const valorComissao = Math.round(plano.valor * (perc / 100) * 100) / 100

    const r = montarSplitComissao({
      walletId: parceiro.walletId,
      valorComissao,
      valorCobranca: valorCobrado,
      forma: forma === 'parcelado' ? 'CREDIT_CARD' : undefined,
      descricao: `Comissão ${parceiro.nome} — plano ${plano.nome}`,
    })

    if (!r.ok) {
      // Guarda de estouro recusou: NÃO injeta split, mas registra a intenção +
      // a causa, para o accrual nascer 'pendente' com o motivo (nada some).
      return { split: [], parceiroId: parceiro.id, splitWalletId: parceiro.walletId, splitValor: null, splitPercentual: perc, splitErro: r.erro }
    }

    // Parceiro sem walletId: montarSplitComissao devolve split vazio (não é erro).
    // Guarda o parceiroId + percentual → accrual 'pendente' (repasse manual).
    const semWallet = !parceiro.walletId
    return {
      split: r.split,
      parceiroId: parceiro.id,
      splitWalletId: parceiro.walletId,
      splitValor: semWallet ? null : valorComissao,
      splitPercentual: perc,
      splitErro: null,
    }
  } catch (e) {
    console.error(`[SPLIT] resolução falhou ws=${workspaceId}:`, (e as Error)?.message)
    return VAZIO
  }
}
