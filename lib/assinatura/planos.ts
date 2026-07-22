// Definição dos planos do SOA. Valor e ciclo NUNCA hardcoded fora daqui: a
// assinatura, a tela de pagamento e o cálculo de comissão leem todos deste mesmo
// lugar. Mudar um preço é mudar uma linha, não caçar número espalhado pelo código.

import type { CicloAssinatura } from '@/lib/pagamento/asaas'

export type PlanoId = 'mensal' | 'anual'

export interface Plano {
  id: PlanoId
  nome: string
  /** Valor de CADA cobrança, no ciclo do plano (não é mensalizado). */
  valor: number
  ciclo: CicloAssinatura
  /** Quanto sai por mês, para a artesã comparar. Só apresentação. */
  equivalenteMensal: number
  /** Economia percentual contra o mensal. 0 = sem desconto. */
  descontoPerc: number
  destaque?: string
}

/**
 * ⚠️ VALORES A CONFIRMAR PELO JÚNIOR no painel da Hotmart.
 *
 * Origem: `app/landing/page.tsx` — `PRECO_BASIC_MENSAL = 29.90` e
 * `PRECO_BASIC_ANUAL = 20.03` ("R$20,03/mês — R$240,40/ano à vista", 33% off).
 *
 * Não deu para conferir contra a Hotmart: a tabela `HotmartAssinatura` está
 * VAZIA em produção (o sync do painel de assinantes nunca rodou), então não há
 * registro do que é efetivamente cobrado hoje.
 */
export const PLANOS: Record<PlanoId, Plano> = {
  mensal: {
    id: 'mensal',
    nome: 'Mensal',
    valor: 29.90,
    ciclo: 'MONTHLY',
    equivalenteMensal: 29.90,
    descontoPerc: 0,
  },
  anual: {
    id: 'anual',
    nome: 'Anual',
    valor: 240.40,
    ciclo: 'YEARLY',
    equivalenteMensal: 20.03,
    descontoPerc: 33,
    destaque: 'Economize 33%',
  },
}

export const PLANO_PADRAO: PlanoId = 'mensal'

export function ehPlanoValido(id: unknown): id is PlanoId {
  return id === 'mensal' || id === 'anual'
}

export function getPlano(id: unknown): Plano {
  return ehPlanoValido(id) ? PLANOS[id] : PLANOS[PLANO_PADRAO]
}

export function listarPlanos(): Plano[] {
  return [PLANOS.mensal, PLANOS.anual]
}

/** "R$ 29,90" */
export function formatarBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Percentual de comissão do parceiro para o plano.
 *
 * A escolha entre mensal e anual é POR PARCEIRO (`Parceiro.comissaoPercAnual` /
 * `comissaoPercMensal`), não uma constante global — o modelo de `lib/parceiros`
 * já previa isso. Os 40% do anual são o valor que o Master cadastra no parceiro.
 */
export function percentualDoPlano(
  plano: Plano,
  parceiro: { comissaoPercMensal: number; comissaoPercAnual: number },
): number {
  return plano.ciclo === 'YEARLY' ? parceiro.comissaoPercAnual : parceiro.comissaoPercMensal
}
