// Definição dos planos do SOA. Valor e ciclo NUNCA hardcoded fora daqui: a
// assinatura, a tela de pagamento e o cálculo de comissão leem todos deste mesmo
// lugar. Mudar um preço é mudar uma linha, não caçar número espalhado pelo código.

import type { CicloAssinatura } from '@/lib/pagamento/asaas'

export type PlanoId = 'mensal' | 'anual'

export interface Plano {
  id: PlanoId
  nome: string
  /** Valor de CADA cobrança, no ciclo do plano (não é mensalizado). À VISTA. */
  valor: number
  ciclo: CicloAssinatura
  /** Quanto sai por mês, para a artesã comparar. Só apresentação. */
  equivalenteMensal: number
  /** Economia percentual contra o mensal. 0 = sem desconto. */
  descontoPerc: number
  destaque?: string
  /** Opção parcelada no cartão, quando existir. Ver aviso em PARCELADO_12X. */
  parcelado?: Parcelamento
}

/**
 * Parcelamento COM JUROS. O total parcelado é MAIOR que o à vista — não é
 * "240,40 dividido por 12". Confundir os dois cobra a menos e come a margem.
 */
export interface Parcelamento {
  parcelas: number
  valorParcela: number
  /** parcelas × valorParcela. É este o valor que vai em `totalValue` no Asaas. */
  total: number
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
/**
 * Anual parcelado — 12 × R$ 23,99 = **R$ 287,88**, os MESMOS números da Hotmart.
 *
 * ⚠️ O parcelado tem JUROS EMBUTIDOS. Não é o à vista dividido: 240,40/12 daria
 * R$ 20,03 e cobraria R$ 47,48 a menos por assinante — erro que já apareceu numa
 * investigação minha e que a landing (`app/landing/page.tsx:1499`) sempre teve
 * certo: "R$240,40 à vista — ou 12x R$23,99 com juros".
 *
 * NÃO IMPLEMENTADO ainda: depende do veredito da Opção D (parcelamento com cartão
 * tokenizado + renovação pelo nosso job). Provado viável no sandbox —
 * POST /v3/payments com installmentCount + creditCardToken cria o parcelamento
 * sem a artesã redigitar o cartão, e o split aceita `totalFixedValue`.
 * Os números ficam aqui para que nenhuma tela ou script use o preço errado.
 */
export const PARCELADO_12X: Parcelamento = {
  parcelas: 12,
  valorParcela: 23.99,
  total: 287.88,
}

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
    valor: 240.40,           // À VISTA — nunca dividir este número por 12
    ciclo: 'YEARLY',
    equivalenteMensal: 20.03,
    descontoPerc: 33,
    destaque: 'Economize 33%',
    parcelado: PARCELADO_12X,
  },
}

export const PLANO_PADRAO: PlanoId = 'mensal'

/** Como ela paga. O anual em 12x é o único caso com valor total diferente. */
export type FormaPagamento = 'avista' | 'parcelado'

/**
 * MATRIZ DE PREÇOS (fechada pelo Júnior):
 *
 *   Pix     mensal  R$ 29,90/mês   ·  anual  R$ 240,40 à vista
 *   Cartão  mensal  R$ 29,90/mês   ·  anual  R$ 240,40 à vista OU 12x R$ 23,99
 *
 * ⚠️ Pix NUNCA cobra 287,88 — o parcelado só existe no cartão.
 *
 * ⚠️ O valor cobrado é o VALOR DO ITEM enviado ao checkout, e o Asaas apenas o
 *    DIVIDE: ele não acrescenta juros (o que /myAccount/fees mostra são as taxas
 *    que ele cobra de nós, não do cliente). Logo, para a parcela sair 23,99 o
 *    item tem de ser 287,88 — mandar 240,40 com 12x cobraria 12 × 20,03 e
 *    perderia R$ 47,48 por assinante anual.
 */
export function valorCobrado(plano: Plano, forma: FormaPagamento): number {
  if (plano.id === 'anual' && forma === 'parcelado') return PARCELADO_12X.total
  return plano.valor
}

/** Quantas parcelas mandar ao checkout. 1 = à vista. */
export function parcelasDe(plano: Plano, forma: FormaPagamento): number {
  return plano.id === 'anual' && forma === 'parcelado' ? PARCELADO_12X.parcelas : 1
}

/** O parcelado só existe no cartão, e só no anual. */
export function permiteParcelar(plano: Plano, metodo: 'cartao' | 'pix'): boolean {
  return plano.id === 'anual' && metodo === 'cartao'
}

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
