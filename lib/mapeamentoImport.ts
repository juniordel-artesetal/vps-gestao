// lib/mapeamentoImport.ts — de-para de colunas para os importadores — VPS-20260630-NQA8
// Campos-alvo = nomes de coluna que os endpoints de import já leem (Nome, Preço, etc.)

export interface CampoImport { campo: string; obrig: boolean; desc: string }

export const CAMPOS_IMPORT: Record<'produtos' | 'materiais' | 'clientes', CampoImport[]> = {
  produtos: [
    { campo: 'Nome', obrig: true, desc: 'nome do produto' },
    { campo: 'Descrição', obrig: false, desc: 'descrição do produto' },
    { campo: 'Preço', obrig: false, desc: 'preço de venda (ex: 66,90)' },
  ],
  materiais: [
    { campo: 'Nome', obrig: true, desc: 'nome do material' },
    { campo: 'Descrição', obrig: false, desc: 'descrição do material' },
    { campo: 'Valor de repasse', obrig: false, desc: 'preço/custo do material (ex: "R$ 11,43 / m²")' },
    { campo: 'Fornecedores', obrig: false, desc: 'fornecedor do material' },
    { campo: 'Peças que fazem uso', obrig: false, desc: 'produtos que usam este material (separados por vírgula)' },
  ],
  clientes: [
    { campo: 'Nome do cliente', obrig: true, desc: 'nome do cliente' },
    { campo: 'Email', obrig: false, desc: 'e-mail do cliente' },
    { campo: 'Telefone', obrig: false, desc: 'telefone ou whatsapp' },
    { campo: 'Cidade', obrig: false, desc: 'cidade (pode incluir a UF, ex: "Indaiatuba-SP")' },
    { campo: 'Último pedido', obrig: false, desc: 'data do último pedido' },
    { campo: 'Status último pedido', obrig: false, desc: 'status do último pedido' },
    { campo: 'Total de pedidos', obrig: false, desc: 'total de pedidos (número)' },
    { campo: 'Pedidos finalizados', obrig: false, desc: 'quantidade de pedidos finalizados' },
    { campo: 'Pedidos em aberto', obrig: false, desc: 'quantidade de pedidos em aberto' },
  ],
}

// A planilha já está no formato esperado se TODOS os campos obrigatórios existem como coluna.
export function jaNoFormato(headers: string[], campos: CampoImport[]): boolean {
  return campos.filter(c => c.obrig).every(c => headers.includes(c.campo))
}

// Parse TOLERANTE de preço vindo de planilha (Excel/Sheets/CSV) — fonte ÚNICA usada
// no client (preview) e no server (import), pra não divergirem. Aceita:
//  • número nativo do Excel (46.9) ou texto ("R$ 46,90", "46,90", "46.90");
//  • milhar + decimal em BR (1.234,56) e US (1,234.56) — o ÚLTIMO separador é o decimal;
//  • símbolo de moeda, unidades/sufixos ("R$ 45,90/un"), espaços comuns E invisíveis
//    (NBSP  , zero-width ​, BOM ﻿) que o \s do regex antigo não pegava.
// Retorna 0 só quando a célula está de fato vazia/sem número — nunca por lixo de formatação.
export function parsePrecoImport(raw: any): number {
  if (typeof raw === 'number') return isFinite(raw) && raw > 0 ? Math.round(raw * 100) / 100 : 0
  // Mantém só dígitos, vírgula, ponto e sinal — remove R$, letras, unidades e QUALQUER
  // caractere invisível (inclui zero-width/BOM, que não são "\s").
  let s = String(raw ?? '').replace(/[^\d.,-]/g, '')
  if (!s || s === '-') return 0
  const temVirgula = s.includes(','), temPonto = s.includes('.')
  if (temVirgula && temPonto) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')   // BR: 1.234,56 → 1234.56
      : s.replace(/,/g, '')                       // US: 1,234.56 → 1234.56
  } else if (temVirgula) {
    s = s.replace(',', '.')                       // 45,90 → 45.90
  }
  // só ponto (45.90) ou sem separador (45) já estão prontos p/ parseFloat
  const v = parseFloat(s)
  return isNaN(v) || v < 0 ? 0 : Math.round(v * 100) / 100
}

// Renomeia as colunas das linhas cruas para os nomes esperados pelos endpoints de import.
export function aplicarMapeamento(
  linhas: Record<string, any>[],
  mapeamento: Record<string, string>,
  campos: CampoImport[]
): Record<string, any>[] {
  return linhas.map(row => {
    const novo: Record<string, any> = {}
    for (const c of campos) {
      const origem = mapeamento[c.campo]
      novo[c.campo] = origem && origem in row ? row[origem] : ''
    }
    return novo
  })
}
