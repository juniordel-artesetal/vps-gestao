// Cálculo único do total do orçamento (servidor e cliente devem bater).
// Total do item = (qtd × valorUnit) − desconto (R$ ou %). Total = Σ itens + frete.
// Precisão: não arredonda antes de somar; só o total final é usado.

export type OrcItemCalc = {
  quantidade: number | string | null
  valorUnitario: number | string | null
  desconto?: number | string | null
  descontoTipo?: string | null
}

export function totalItemOrcamento(it: OrcItemCalc): number {
  const qtd = Number(it.quantidade) || 1
  const unit = Number(it.valorUnitario) || 0
  const bruto = qtd * unit
  const desc = Number(it.desconto) || 0
  const abatimento = it.descontoTipo === 'percentual' ? bruto * (desc / 100) : desc
  return Math.max(0, bruto - abatimento)
}

export function subtotalBrutoOrcamento(itens: OrcItemCalc[]): number {
  return (itens || []).reduce((s, it) => s + (Number(it.quantidade) || 1) * (Number(it.valorUnitario) || 0), 0)
}

export function totalDescontoOrcamento(itens: OrcItemCalc[]): number {
  return (itens || []).reduce((s, it) => {
    const bruto = (Number(it.quantidade) || 1) * (Number(it.valorUnitario) || 0)
    const desc = Number(it.desconto) || 0
    return s + (it.descontoTipo === 'percentual' ? bruto * (desc / 100) : desc)
  }, 0)
}

export function totalOrcamento(itens: OrcItemCalc[], frete: number | string | null): number {
  const somaItens = (itens || []).reduce((s, it) => s + totalItemOrcamento(it), 0)
  return somaItens + (Number(frete) || 0)
}
