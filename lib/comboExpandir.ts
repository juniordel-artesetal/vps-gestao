// Expansão de COMBO em linhas de pedido — FONTE ÚNICA (pura, sem prisma), usada pela
// tela de Pedidos (client) e pela loja online (server). Decisão do produto:
//   1 LINHA DE PREÇO (o combo, com o precoCombo) para o cliente
//   + N linhas de COMPONENTES (valor 0) para a PRODUÇÃO/ESTOQUE — nada se perde.
// Mesmo padrão dos kits: o total não infla (componentes com valor 0) e cada peça é
// conhecida em camposExtras.produtos[] (baixa de estoque na expedição).

export interface ComboItemLite { nomeProduto: string; qtd: number; variacaoId?: string | null }
export interface LinhaProduto {
  nome: string
  quantidade: number
  valorUnitario: number | null
  combo?: boolean          // true = linha de preço do combo (não é peça)
  componenteDe?: string    // nome do combo do qual esta peça faz parte
  variacaoId?: string | null
}

/** Gera as linhas de produtos[] para um combo comprado em `lineQty` unidades. */
export function expandirCombo(
  combo: { nome: string; precoCombo: number; items?: ComboItemLite[] },
  lineQty: number,
): LinhaProduto[] {
  const q = Math.max(1, Math.round(Number(lineQty) || 1))
  const preco = Math.max(0, Number(combo.precoCombo) || 0)
  const linhas: LinhaProduto[] = [
    { nome: `🎁 ${combo.nome}`, quantidade: q, valorUnitario: preco, combo: true },
  ]
  for (const it of (combo.items || [])) {
    linhas.push({
      nome: it.nomeProduto,
      quantidade: Math.max(1, Math.round(Number(it.qtd) || 1)) * q,
      valorUnitario: 0,                 // preço fica na linha do combo — não infla o total
      componenteDe: combo.nome,
      variacaoId: it.variacaoId ?? null,
    })
  }
  return linhas
}

/** Total de PEÇAS de um combo (soma das qtds dos componentes) × lineQty — para Order.quantidade. */
export function pecasDoCombo(combo: { items?: ComboItemLite[] }, lineQty: number): number {
  const q = Math.max(1, Math.round(Number(lineQty) || 1))
  const pecas = (combo.items || []).reduce((s, it) => s + Math.max(1, Math.round(Number(it.qtd) || 1)), 0)
  return (pecas || 1) * q
}
