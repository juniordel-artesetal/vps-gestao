// Constrói a camada fiscal/financeira Shopee a partir do AOA (array de arrays:
// linha 0 = cabeçalho). Lê por NOME+OCORRÊNCIA (posição) — robusto a reordenação
// e às colunas duplicadas ("Desconto do vendedor" ×2 e "Cidade" ×2, onde a 2ª tem
// a cidade real). Valores de PEDIDO pegos 1x (1ª linha do grupo); itens somam.
// liquidoEstimado é ESTIMADO (a Shopee não informa o repasse real).

export interface ItemFiscal {
  produto: string | null; sku: string | null; skuRef: string | null; variacao: string | null
  qtd: number; qtdDevolvida: number
  precoOriginal: number; precoAcordado: number; subtotal: number; pesoSku: number
}

export interface PedidoFiscal {
  idExterno: string
  statusExterno: string | null; statusDevolucao: string | null; rastreio: string | null; opcaoEnvio: string | null
  dataCriacaoExterna: string | null; dataPagamento: string | null; dataPrevistaEnvioExterna: string | null
  subtotalProdutos: number; freteComprador: number; descontoVendedor: number
  descontoShopee: number; cupomVendedor: number; cupomShopee: number
  ajusteAcaoComercial: number; valorTotal: number; totalGlobal: number
  taxaTransacao: number; comissaoBruta: number; comissaoLiquida: number
  servicoBruta: number; servicoLiquida: number; freteReverso: number
  freteEstimado: number; liquidoEstimado: number
  destinatarioNome: string | null; cpfPlain: string | null; telefoneMascarado: string | null
  endereco: string | null; bairro: string | null; cidade: string | null
  uf: string | null; cep: string | null; pais: string | null
  observacaoComprador: string | null
  itens: ItemFiscal[]
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const num = (v: any): number => {
  const n = parseFloat(String(v ?? '').replace(',', '.').replace(/[^\d.\-]/g, ''))
  return isNaN(n) ? 0 : n
}
const txt = (v: any): string | null => {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}

export function construirFiscalShopee(aoa: any[][]): Map<string, PedidoFiscal> {
  const out = new Map<string, PedidoFiscal>()
  if (!Array.isArray(aoa) || aoa.length < 2 || !Array.isArray(aoa[0])) return out

  // Mapa cabeçalho → lista de índices (para lidar com nomes duplicados por posição)
  const idxMap = new Map<string, number[]>()
  aoa[0].forEach((h: any, i: number) => {
    const nome = String(h ?? '').trim()
    const arr = idxMap.get(nome) || []
    arr.push(i); idxMap.set(nome, arr)
  })
  const cell = (row: any[], nome: string, occ = 0): any => {
    const arr = idxMap.get(nome)
    if (!arr || arr[occ] === undefined) return ''
    return row[arr[occ]]
  }

  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r]
    if (!Array.isArray(row)) continue
    const idExterno = String(cell(row, 'ID do pedido') ?? '').trim()
    if (!idExterno) continue

    const item: ItemFiscal = {
      produto:       txt(cell(row, 'Nome do Produto')),
      sku:           txt(cell(row, 'Número de referência SKU')),
      skuRef:        txt(cell(row, 'Nº de referência do SKU principal')),
      variacao:      txt(cell(row, 'Nome da variação')),
      qtd:           Math.max(1, Math.round(num(cell(row, 'Quantidade'))) || 1),
      qtdDevolvida:  Math.round(num(cell(row, 'Returned quantity'))) || 0,
      precoOriginal: num(cell(row, 'Preço original')),
      precoAcordado: num(cell(row, 'Preço acordado')),
      subtotal:      num(cell(row, 'Subtotal do produto')),
      pesoSku:       num(cell(row, 'Peso total SKU')),
    }

    const existente = out.get(idExterno)
    if (existente) {
      existente.itens.push(item)
      existente.subtotalProdutos = round2(existente.subtotalProdutos + item.subtotal)
      continue
    }

    // Valores de PEDIDO — pegos UMA vez (esta é a 1ª linha do grupo)
    out.set(idExterno, {
      idExterno,
      statusExterno:            txt(cell(row, 'Status do pedido')),
      statusDevolucao:          txt(cell(row, 'Status da Devolução / Reembolso')),
      rastreio:                 txt(cell(row, 'Número de rastreamento')),
      opcaoEnvio:               txt(cell(row, 'Opção de envio')),
      dataCriacaoExterna:       txt(cell(row, 'Data de criação do pedido')),
      dataPagamento:            txt(cell(row, 'Hora do pagamento do pedido')),
      dataPrevistaEnvioExterna: txt(cell(row, 'Data prevista de envio')),
      // Descontos/cupons (nível pedido)
      descontoVendedor:    round2(num(cell(row, 'Desconto do vendedor', 0)) + num(cell(row, 'Desconto do vendedor', 1))),
      descontoShopee:      num(cell(row, 'Desconto Shopee da Leve Mais por Menos')),
      cupomVendedor:       num(cell(row, 'Cupom do vendedor')),
      cupomShopee:         num(cell(row, 'Cupom Shopee')),
      ajusteAcaoComercial: num(cell(row, 'Ajuste por participação em ação comercial')),
      // Totais e fretes (nível pedido)
      valorTotal:      num(cell(row, 'Valor Total')),
      totalGlobal:     num(cell(row, 'Total global')),
      freteComprador:  num(cell(row, 'Taxa de envio pagas pelo comprador')),
      freteReverso:    num(cell(row, 'Taxa de Envio Reversa')),
      freteEstimado:   num(cell(row, 'Valor estimado do frete')),
      // Taxas (nível pedido)
      taxaTransacao:   num(cell(row, 'Taxa de transação')),
      comissaoBruta:   num(cell(row, 'Taxa de comissão bruta')),
      comissaoLiquida: num(cell(row, 'Taxa de comissão líquida')),
      servicoBruta:    num(cell(row, 'Taxa de serviço bruta')),
      servicoLiquida:  num(cell(row, 'Taxa de serviço líquida')),
      subtotalProdutos: round2(item.subtotal),
      liquidoEstimado: 0, // calculado ao final
      // Destinatário / endereço (a 2ª "Cidade" traz a cidade real)
      destinatarioNome:    txt(cell(row, 'Nome do destinatário')),
      cpfPlain:            (String(cell(row, 'CPF do Comprador') ?? '').replace(/\D/g, '') || null),
      telefoneMascarado:   txt(cell(row, 'Telefone')),
      endereco:            txt(cell(row, 'Endereço de entrega')),
      bairro:              txt(cell(row, 'Bairro')),
      cidade:              txt(cell(row, 'Cidade', 1)) ?? txt(cell(row, 'Cidade', 0)),
      uf:                  txt(cell(row, 'UF')),
      cep:                 txt(cell(row, 'CEP')),
      pais:                txt(cell(row, 'País')),
      observacaoComprador: txt(cell(row, 'Observação do comprador')),
      itens: [item],
    })
  }

  // liquidoEstimado = Total global − comissão líquida − serviço líquida − taxa de transação − frete reverso
  for (const p of out.values()) {
    p.liquidoEstimado = round2(p.totalGlobal - p.comissaoLiquida - p.servicoLiquida - p.taxaTransacao - p.freteReverso)
  }

  return out
}
