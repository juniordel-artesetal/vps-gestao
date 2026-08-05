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
/** Valor à vista do anual (1 cobrança). Fonte única do preço base. */
export const ANUAL_AVISTA = 240.40

/** Nº máximo de parcelas do anual no cartão. */
export const MAX_PARCELAS_ANUAL = 12

/**
 * Taxa mensal do parcelamento (Tabela Price). Calibrada para que 12x feche EXATO
 * no número da Hotmart — 12 × R$ 23,99 = R$ 287,88 sobre o à vista R$ 240,40.
 * À vista (1x) NUNCA tem juros. Mudar esta taxa muda TODA a coluna de preços.
 */
export const TAXA_PARCELAMENTO_ANUAL = 0.028850

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Parcelamento do anual em N vezes (1 a 12), com juros Price a partir de 2x.
 * 1x = à vista, sem juros. O `total` é o que vai em `items[].value` no checkout
 * (o Asaas apenas DIVIDE esse total por N — não acrescenta juros).
 */
export function calcularParcelamentoAnual(parcelas: number): Parcelamento {
  const n = Math.max(1, Math.min(MAX_PARCELAS_ANUAL, Math.floor(Number(parcelas)) || 1))
  if (n === 1) return { parcelas: 1, valorParcela: ANUAL_AVISTA, total: ANUAL_AVISTA }
  const i = TAXA_PARCELAMENTO_ANUAL
  const valorParcela = round2(ANUAL_AVISTA * i / (1 - Math.pow(1 + i, -n)))
  return { parcelas: n, valorParcela, total: round2(valorParcela * n) }
}

/** Tabela completa 1..12 do anual — pra tela mostrar cada opção. */
export function tabelaParcelamentoAnual(): Parcelamento[] {
  return Array.from({ length: MAX_PARCELAS_ANUAL }, (_, k) => calcularParcelamentoAnual(k + 1))
}

/** O 12x continua sendo a oferta-vitrine (e-mails, cron). Deriva da mesma conta. */
export const PARCELADO_12X: Parcelamento = calcularParcelamentoAnual(12)

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
    valor: ANUAL_AVISTA,     // À VISTA — nunca dividir este número por 12
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

/** Nº de parcelas permitidas p/ o plano/método: anual+cartão = 1..12; resto = [1]. */
export function parcelasPermitidas(plano: Plano, metodo: 'cartao' | 'pix'): number[] {
  return permiteParcelar(plano, metodo)
    ? Array.from({ length: MAX_PARCELAS_ANUAL }, (_, k) => k + 1)
    : [1]
}

/**
 * Resolve o parcelamento efetivo (total + nº de parcelas) do plano/método pela
 * quantidade pedida. Fora do anual+cartão, sempre 1x pelo valor do plano.
 */
export function resolverParcelamento(
  plano: Plano,
  metodo: 'cartao' | 'pix',
  parcelas: number,
): Parcelamento {
  if (plano.id === 'anual' && permiteParcelar(plano, metodo)) {
    return calcularParcelamentoAnual(parcelas)
  }
  return { parcelas: 1, valorParcela: plano.valor, total: plano.valor }
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
