// Cálculo PURO de rateio de custos fixos (sem prisma) — FONTE ÚNICA usada por:
//   • o preço sugerido na tela de Produtos (client)
//   • o simulador e a rota /api/precificacao/custos-fixos (server)
//   • o Resultado das vendas
// Assim a matemática nunca diverge entre as telas.

export type MetodoRateio = 'unidades' | 'horas' | 'faturamento' | 'manual'

export interface CustosFixosConfig {
  ativo: boolean
  metodo: MetodoRateio
  custoFixoMensal: number
  itens: { nome: string; valor: number }[]
  unidadesMes: number
  horasMes: number
  faturamentoMes: number
  valorManual: number
  percentualPerda: number
}

export const PADRAO: CustosFixosConfig = {
  ativo: false, metodo: 'horas', custoFixoMensal: 0, itens: [],
  unidadesMes: 0, horasMes: 0, faturamentoMes: 0, valorManual: 0, percentualPerda: 0,
}

export const METODOS: { id: MetodoRateio; nome: string; explicacao: string }[] = [
  { id: 'unidades', nome: 'Por unidades produzidas', explicacao: 'Divide os custos fixos do mês pelo número de peças que você produz no mês. Cada peça carrega a mesma fatia. Bom quando seus produtos dão trabalho parecido.' },
  { id: 'horas', nome: 'Por horas de produção', explicacao: 'Divide os custos fixos pelas horas que você trabalha no mês (custo fixo por hora) e cobra de cada peça conforme o tempo dela. Mais justo para ateliê: quem demora mais carrega mais.' },
  { id: 'faturamento', nome: 'Por faturamento', explicacao: 'Os custos fixos viram uma % do seu faturamento (fixos ÷ faturamento do mês) e essa % entra no preço, como um imposto. Bom quando você tem produtos de valores bem diferentes.' },
  { id: 'manual', nome: 'Valor fixo por peça', explicacao: 'Você mesma define um valor fixo de custo por peça (ex.: R$ 5,00). Simples e direto, se você já sabe o quanto quer embutir.' },
]

export function arred(n: number): number { return Math.round((Number(n) || 0) * 100) / 100 }

export function parseItens(raw: unknown): { nome: string; valor: number }[] {
  const a = Array.isArray(raw) ? raw : (typeof raw === 'string' ? (() => { try { return JSON.parse(raw) } catch { return [] } })() : [])
  return (Array.isArray(a) ? a : []).map((x: { nome?: string; valor?: number }) => ({ nome: String(x?.nome || ''), valor: Number(x?.valor) || 0 }))
}

/** Quanto de custo fixo cai NAQUELA peça: em R$ (métodos unidades/horas/manual) OU como %
 *  do preço (faturamento). `horasProduto` é obrigatório só no método 'horas'. */
export function ratearCustoFixo(cfg: CustosFixosConfig, ctx: { horasProduto?: number } = {}): { rateioRS: number; rateioPct: number } {
  if (!cfg.ativo) return { rateioRS: 0, rateioPct: 0 }
  const F = Math.max(0, cfg.custoFixoMensal || 0)
  switch (cfg.metodo) {
    case 'unidades': return { rateioRS: cfg.unidadesMes > 0 ? arred(F / cfg.unidadesMes) : 0, rateioPct: 0 }
    case 'horas': {
      const porHora = cfg.horasMes > 0 ? F / cfg.horasMes : 0
      return { rateioRS: arred(porHora * Math.max(0, ctx.horasProduto || 0)), rateioPct: 0 }
    }
    case 'faturamento': return { rateioRS: 0, rateioPct: cfg.faturamentoMes > 0 ? F / cfg.faturamentoMes : 0 }
    case 'manual': return { rateioRS: arred(Math.max(0, cfg.valorManual || 0)), rateioPct: 0 }
    default: return { rateioRS: 0, rateioPct: 0 }
  }
}

/** True quando o método 'horas' está ativo mas a peça não tem tempo informado → o preço
 *  não pode embutir o fixo ainda (avisar, nunca ignorar em silêncio). */
export function faltaTempoPorHoras(cfg: CustosFixosConfig, horasProduto?: number): boolean {
  return cfg.ativo && cfg.metodo === 'horas' && !(Number(horasProduto) > 0)
}

/** Custo fixo em R$ que cai numa venda de preço `preco`. */
export function custoFixoDaVenda(cfg: CustosFixosConfig, preco: number, ctx: { horasProduto?: number } = {}): number {
  const { rateioRS, rateioPct } = ratearCustoFixo(cfg, ctx)
  return arred(rateioRS + Math.max(0, preco || 0) * rateioPct)
}

/** Lucro REAL de uma venda = preço − variáveis − taxa do canal (R$) − imposto − custo fixo rateado. */
export function lucroReal(p: { preco: number; custoVariavel: number; taxaCanalRS?: number; impostoPct?: number; custoFixoRateado: number }): number {
  const imposto = Math.max(0, p.preco || 0) * (Math.max(0, p.impostoPct || 0) / 100)
  return arred((p.preco || 0) - (p.custoVariavel || 0) - (p.taxaCanalRS || 0) - imposto - (p.custoFixoRateado || 0))
}
