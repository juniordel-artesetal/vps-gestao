// Agrupa os lançamentos de UM dia do Fluxo de Caixa em 4 seções (A pagar / A receber / Entrou / Saiu)
// com subtotais que BATEM EXATAMENTE com a linha do dia — inclusive o split de PARCIAL:
//   realizado = status IN (PAGO,PARCIAL) ? (valorRealizado ?? valor) : 0   → Entrou (RECEITA) / Saiu (DESPESA)
//   aberto    = status IN (PENDENTE,PARCIAL) ? (valor − (valorRealizado ?? 0)) : 0 → A receber / A pagar
// Um PARCIAL aparece em DUAS seções (parte realizada + parte em aberto). Financeiro PESSOAL não usa
// PARCIAL/valorRealizado → cai no caso simples PAGO=realizado / PENDENTE=aberto. Pura (client-side).

export interface LancFluxo {
  id: string; tipo: string; descricao: string; valor: number; valorRealizado?: number | null
  status: string; parcela?: number | null; totalParcelas?: number | null
  categoriaIcone?: string | null; categoriaNome?: string | null; contaNome?: string | null
}
export interface ItemSecao extends LancFluxo { valorSecao: number }
export interface SecaoDia { itens: ItemSecao[]; subtotal: number }
export interface DiaAgrupado { aPagar: SecaoDia; aReceber: SecaoDia; entrou: SecaoDia; saiu: SecaoDia; vazio: boolean }

const REALIZADO = ['PAGO', 'PARCIAL']
const ABERTO = ['PENDENTE', 'PARCIAL']

export function agruparDiaFluxo(lancs: LancFluxo[] | undefined | null): DiaAgrupado {
  const aPagar: ItemSecao[] = [], aReceber: ItemSecao[] = [], entrou: ItemSecao[] = [], saiu: ItemSecao[] = []
  for (const l of lancs || []) {
    // RESERVA/RESGATE (transferências internas de caixinha) não entram em nenhuma seção — só afetam o saldo.
    if (l.tipo !== 'RECEITA' && l.tipo !== 'DESPESA') continue
    const vr = l.valorRealizado ?? null
    const realizado = REALIZADO.includes(l.status) ? (vr ?? l.valor) : 0
    const aberto = ABERTO.includes(l.status) ? (l.valor - (vr ?? 0)) : 0
    if (l.tipo === 'RECEITA') {
      if (realizado > 0.0001) entrou.push({ ...l, valorSecao: realizado })
      if (aberto > 0.0001) aReceber.push({ ...l, valorSecao: aberto })
    } else {
      if (realizado > 0.0001) saiu.push({ ...l, valorSecao: realizado })
      if (aberto > 0.0001) aPagar.push({ ...l, valorSecao: aberto })
    }
  }
  const soma = (a: ItemSecao[]) => a.reduce((s, i) => s + i.valorSecao, 0)
  const secao = (itens: ItemSecao[]): SecaoDia => ({ itens, subtotal: soma(itens) })
  return {
    aPagar: secao(aPagar), aReceber: secao(aReceber), entrou: secao(entrou), saiu: secao(saiu),
    vazio: !aPagar.length && !aReceber.length && !entrou.length && !saiu.length,
  }
}
