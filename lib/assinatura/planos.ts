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
/** Valor à vista do anual ANTIGO (até 04/10/2026). Assinantes anuais dessa época renovam nele (grandfather). */
export const ANUAL_AVISTA = 240.40
/** Valor à vista do anual NOVO — assinaturas criadas a partir de 05/10/2026 00:00 (Brasília). Decisão do Júnior, 04/10. */
export const ANUAL_AVISTA_NOVO = 370.00

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
export function calcularParcelamentoAnual(parcelas: number, base: number = ANUAL_AVISTA): Parcelamento {
  const n = Math.max(1, Math.min(MAX_PARCELAS_ANUAL, Math.floor(Number(parcelas)) || 1))
  if (n === 1) return { parcelas: 1, valorParcela: base, total: base }
  const i = TAXA_PARCELAMENTO_ANUAL
  const valorParcela = round2(base * i / (1 - Math.pow(1 + i, -n)))
  return { parcelas: n, valorParcela, total: round2(valorParcela * n) }
}

/** Anual à vista para uma assinatura NOVA criada em `agora` (240,40 até 04/10; 370,00 a partir de 05/10). */
export function anualAvistaVigente(agora: Date = new Date()): number {
  return agora.getTime() >= VIGENCIA_PRECO_NOVO.getTime() ? ANUAL_AVISTA_NOVO : ANUAL_AVISTA
}

/** Tabela completa 1..12 do anual VIGENTE — pra tela mostrar cada opção. */
export function tabelaParcelamentoAnual(agora: Date = new Date()): Parcelamento[] {
  const base = anualAvistaVigente(agora)
  return Array.from({ length: MAX_PARCELAS_ANUAL }, (_, k) => calcularParcelamentoAnual(k + 1, base))
}

/** 12x do anual ANTIGO (R$ 287,88) — referência de quem já assinou parcelado (grandfather). */
export const PARCELADO_12X: Parcelamento = calcularParcelamentoAnual(12)

/** 12x do anual VIGENTE — a oferta-vitrine de hoje (e-mails de conversão, landing). */
export function parcelado12xVigente(agora: Date = new Date()): Parcelamento {
  return calcularParcelamentoAnual(12, anualAvistaVigente(agora))
}

/**
 * REAJUSTE AGENDADO DO MENSAL (decisão do Júnior, 30/09/2026): assinaturas NOVAS criadas a partir
 * de 05/10/2026 00:00 (Brasília) custam R$ 49,90; até 04/10, R$ 29,90. Vira SOZINHO pela data —
 * sem deploy nem flip manual. O ANUAL não muda.
 *
 * GRANDFATHER: o valor fica gravado NA ASSINATURA do Asaas no dia em que ela nasce (checkout = início
 * do teste). Quem já assina — ou começou o teste antes de 05/10 — renova no valor da própria
 * assinatura (R$ 29,90) e NINGUÉM mexe nisso. Cancelou e voltou = assinatura NOVA = preço do dia.
 * Por isso, e-mails/telas de quem JÁ assina leem o valor da AsaasAssinatura, nunca daqui.
 */
export const PRECO_MENSAL_ANTIGO = 29.90
export const PRECO_MENSAL_NOVO = 49.90
/** 05/10/2026 00:00 em Brasília (UTC−3) = 03:00 UTC. */
export const VIGENCIA_PRECO_NOVO = new Date('2026-10-05T03:00:00Z')

/** Preço do mensal para uma assinatura NOVA criada em `agora`. */
export function precoMensalVigente(agora: Date = new Date()): number {
  return agora.getTime() >= VIGENCIA_PRECO_NOVO.getTime() ? PRECO_MENSAL_NOVO : PRECO_MENSAL_ANTIGO
}

/** Mensal num preço explícito (grandfather: campanha de migração das assinantes antigas). */
export function planoMensalNoPreco(valor: number): Plano {
  return { id: 'mensal', nome: 'Mensal', valor, ciclo: 'MONTHLY', equivalenteMensal: valor, descontoPerc: 0 }
}

/** Os planos à venda em `agora` — mensal E anual viram juntos em 05/10/2026 00:00 (Brasília). */
export function planosVigentes(agora: Date = new Date()): Record<PlanoId, Plano> {
  const mensal = precoMensalVigente(agora)
  const anual = anualAvistaVigente(agora)
  const equivalenteMensal = round2(anual / 12)   // 240,40 → 20,03 · 370,00 → 30,83
  const descontoPerc = Math.round((1 - anual / (mensal * 12)) * 100)   // 33% antes · 38% depois
  return {
    mensal: planoMensalNoPreco(mensal),
    anual: {
      id: 'anual',
      nome: 'Anual',
      valor: anual,     // À VISTA — nunca dividir este número por 12
      ciclo: 'YEARLY',
      equivalenteMensal,
      descontoPerc,
      destaque: `Economize ${descontoPerc}%`,
      parcelado: calcularParcelamentoAnual(12, anual),
    },
  }
}

/** Atalho com a data de AGORA (getters: cada leitura pega o preço vigente no momento). */
export const PLANOS: Record<PlanoId, Plano> = {
  get mensal() { return planosVigentes().mensal },
  get anual() { return planosVigentes().anual },
}

export const PLANO_PADRAO: PlanoId = 'mensal'

/** Como ela paga. O anual em 12x é o único caso com valor total diferente. */
export type FormaPagamento = 'avista' | 'parcelado'

/**
 * MATRIZ DE PREÇOS (fechada pelo Júnior) — mensal = precoMensalVigente() (29,90 → 49,90 em 05/10/2026):
 *
 *   (até 04/10)  mensal R$ 29,90 · anual R$ 240,40 à vista OU 12x R$ 23,99
 *   (05/10 em diante) mensal R$ 49,90 · anual R$ 370,00 à vista OU 12x com juros Price (≈ R$ 36,91)
 *   Juros do parcelado = do CLIENTE: o total com juros vai no item do checkout e o Asaas só divide.
 *   ⚠️ NÃO ligar "repassar juros ao cliente" no Asaas para este checkout — cobraria juros em dobro.
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
  if (plano.id === 'anual' && forma === 'parcelado') return calcularParcelamentoAnual(12, plano.valor).total
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
    return calcularParcelamentoAnual(parcelas, plano.valor)
  }
  return { parcelas: 1, valorParcela: plano.valor, total: plano.valor }
}

export function ehPlanoValido(id: unknown): id is PlanoId {
  return id === 'mensal' || id === 'anual'
}

/** Plano no preço vigente em `agora` (assinatura NOVA). */
export function getPlano(id: unknown, agora: Date = new Date()): Plano {
  const p = planosVigentes(agora)
  return ehPlanoValido(id) ? p[id] : p[PLANO_PADRAO]
}

export function listarPlanos(agora: Date = new Date()): Plano[] {
  const p = planosVigentes(agora)
  return [p.mensal, p.anual]
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
