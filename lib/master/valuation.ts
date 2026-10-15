// VALUATION DA EMPRESA (Master → Receitas) — estimativa que se atualiza com os números reais do SOA (MRR, assinantes,
// faturamento acumulado, volume de pedidos das artesãs). Puro: os dados entram prontos (lib/master/valuationDados.ts).
//
// Três leituras, como um investidor faria:
//  1) PISO POR TRAÇÃO — ARR de hoje × múltiplo de SaaS early-stage (3x / 5x / 8x).
//  2) MÉTODO VC (o número do pitch) — ARR projetado para o fim de 2028 (3º ano do roadmap) × múltiplo, trazido a valor de
//     hoje pela taxa de retorno exigida (60% / 50% / 40% a.a.), ajustado pelo FATOR DE EXECUÇÃO: assinantes de hoje × a
//     meta do roadmap para hoje (√, entre 0,5 e 1,2). Assinante acima da meta sobe o valuation; abaixo, desce.
//  3) MERCADO — artesãs no Brasil (TAM), as que vendem com recorrência (SAM) e a meta de 2030 (SOM).
// As premissas ficam aqui, à vista (o card mostra todas): mudar uma delas é mudar este arquivo.

export const PREMISSAS = {
  /** Sebrae/IBGE: ~8,5 milhões de artesãos no Brasil, 77% mulheres. */
  artesaosBrasil: 8_500_000,
  pctMulheres: 0.77,
  /** Premissa: 10% vendem com recorrência e organização de negócio (público que precisa de gestão). */
  pctSam: 0.10,
  /** Metas de assinantes ativos no fim de cada ano (roadmap do Júnior). */
  metas: { 2026: 350, 2027: 1500, 2028: 3000, 2029: 5000, 2030: 8000 } as Record<number, number>,
  /** Ticket médio mensal do assinante novo (mix mensal R$ 49,90 × anual com desconto, sem add-ons). */
  ticketFuturo: 39.9,
  /** Churn mensal alvo nas projeções (o observado hoje aparece à parte, como risco). */
  churnAlvo: 0.04,
  /** Custo de aquisição de um assinante pago (mídia + conteúdo + comercial), premissa. */
  cac: 120,
  /** Divisão da verba (decisão do Júnior). */
  uso: { marketing: 0.4, desenvolvimento: 0.3, comercial: 0.3 },
  cenarios: {
    conservador: { multiplo: 3, desconto: 0.6 },
    base: { multiplo: 5, desconto: 0.5 },
    otimista: { multiplo: 8, desconto: 0.4 },
  },
  anoAlvoVC: 2028,
} as const

export type Cenario = keyof typeof PREMISSAS.cenarios

export interface EntradaValuation {
  hoje: Date
  mrr: number
  ativos: number
  faturamentoAcumulado: number       // receita bruta do SOA desde o início (Asaas + Hotmart)
  faturamentoLiquidoAcumulado: number
  gmvAcumulado: number               // valor dos pedidos que as artesãs gerenciaram no SOA
  gmv30d: number
  pedidos: number
  pedidos30d: number
  ateliers: number                   // workspaces cadastrados
  churnMensalObservado: number | null
}

const r0 = (n: number) => Math.round(n)
const anosAte = (de: Date, ano: number) => Math.max(0.05, (Date.UTC(ano, 11, 31) - de.getTime()) / (365.25 * 86400_000))

/** A meta de assinantes para a data (linha reta entre os fins de ano do roadmap; 1/1/2026 = 0). */
export function metaNaData(d: Date): number {
  const ano = d.getUTCFullYear()
  const fim = PREMISSAS.metas[ano] ?? (ano < 2026 ? 0 : PREMISSAS.metas[2030])
  const ini = ano <= 2026 ? 0 : PREMISSAS.metas[ano - 1] ?? fim
  const t = (d.getTime() - Date.UTC(ano, 0, 1)) / (Date.UTC(ano + 1, 0, 1) - Date.UTC(ano, 0, 1))
  return ini + (fim - ini) * Math.min(1, Math.max(0, t))
}

export function calcularValuation(e: EntradaValuation) {
  const P = PREMISSAS
  const ticketAtual = e.ativos ? e.mrr / e.ativos : 0
  const ticket = Math.max(P.ticketFuturo, ticketAtual)
  const arrAtual = e.mrr * 12
  const metaHoje = metaNaData(e.hoje)
  const fatorExecucao = metaHoje > 0 ? Math.min(1.2, Math.max(0.5, Math.sqrt(e.ativos / metaHoje))) : 1

  // roadmap 2026–2030: assinantes, ARR no fim do ano, receita do ano (média das pontas), valuation no fim do ano (base)
  const anos = [2026, 2027, 2028, 2029, 2030]
  const roadmap = anos.map((ano, i) => {
    const fim = P.metas[ano], ini = i === 0 ? Math.min(e.ativos, fim) : P.metas[anos[i - 1]]
    const tk = ano === 2026 ? Math.max(ticketAtual, (ticketAtual + ticket) / 2) : ticket
    const arr = fim * tk * 12
    const receitaAno = ((ini + fim) / 2) * tk * 12
    // novas assinaturas brutas no ano = crescimento líquido + reposição do churn alvo
    const novasBrutas = Math.max(0, fim - ini) + ((ini + fim) / 2) * P.churnAlvo * 12
    return { ano, assinantes: fim, ticket: tk, arr: r0(arr), receitaAno: r0(receitaAno), novasBrutas: r0(novasBrutas), valuationFimDoAno: r0(arr * P.cenarios.base.multiplo) }
  })

  const arrAlvo = roadmap.find(r => r.ano === P.anoAlvoVC)!.arr
  const n = anosAte(e.hoje, P.anoAlvoVC)
  const cenarios = Object.fromEntries((Object.keys(P.cenarios) as Cenario[]).map(c => {
    const { multiplo, desconto } = P.cenarios[c]
    const vc = (arrAlvo * multiplo) / Math.pow(1 + desconto, n) * fatorExecucao
    const piso = arrAtual * multiplo
    return [c, { multiplo, desconto, piso: r0(piso), vc: r0(vc), valuation: r0(Math.max(piso, vc)) }]
  })) as Record<Cenario, { multiplo: number; desconto: number; piso: number; vc: number; valuation: number }>

  // captação sugerida: a verba de MARKETING (40%) paga o CAC das novas assinaturas até o fim de 2027
  const novasAte2027 = roadmap.filter(r => r.ano <= 2027).reduce((s, r) => s + r.novasBrutas, 0)
  const marketing = novasAte2027 * P.cac
  const captacao = marketing / P.uso.marketing
  const uso = {
    marketing: { pct: P.uso.marketing, valor: r0(captacao * P.uso.marketing), foco: 'Aquisição: mídia paga (Meta/TikTok), conteúdo e comunidade de artesãs, influenciadoras do nicho, programa de parceiras' },
    desenvolvimento: { pct: P.uso.desenvolvimento, valor: r0(captacao * P.uso.desenvolvimento), foco: 'Produto: Método MAE (arte + produção em massa), integrações de marketplace (Shopee, TikTok Shop), app mobile, Sofia IA' },
    comercial: { pct: P.uso.comercial, valor: r0(captacao * P.uso.comercial), foco: 'Comercial e sucesso do cliente: onboarding assistido, suporte, retenção (reduzir churn), vendas para ateliês maiores' },
  }

  const sam = P.artesaosBrasil * P.pctSam
  return {
    premissas: P,
    hoje: {
      mrr: e.mrr, arr: r0(arrAtual), ativos: e.ativos, ticketAtual: Math.round(ticketAtual * 100) / 100,
      metaHoje: r0(metaHoje), fatorExecucao: Math.round(fatorExecucao * 100) / 100,
      faturamentoAcumulado: e.faturamentoAcumulado, faturamentoLiquidoAcumulado: e.faturamentoLiquidoAcumulado,
      gmvAcumulado: e.gmvAcumulado, gmv30d: e.gmv30d, gmvAnualizado: r0(e.gmv30d * 12), pedidos: e.pedidos, pedidos30d: e.pedidos30d,
      ateliers: e.ateliers, churnMensalObservado: e.churnMensalObservado,
    },
    mercado: {
      tam: P.artesaosBrasil, mulheres: r0(P.artesaosBrasil * P.pctMulheres), sam: r0(sam), som2030: P.metas[2030],
      pctSamEm2030: Math.round((P.metas[2030] / sam) * 10000) / 100,
      receitaPotencialSam: r0(sam * P.ticketFuturo * 12),
    },
    roadmap,
    cenarios,
    valuationBase: cenarios.base.valuation,
    captacao: { valor: r0(captacao), novasAte2027: r0(novasAte2027), cac: P.cac, uso },
  }
}
export type Valuation = ReturnType<typeof calcularValuation>
