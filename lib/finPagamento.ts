// Regra única de pagamento PARCIAL do Financeiro (FinLancamento).
// Toda a matemática é feita em CENTAVOS (inteiros) pra não ter drift de float
// (o bug do "-1 centavo"). Tolerância de 1 centavo para considerar quitado.
//
// Modelo de status:
//   PENDENTE → nada realizado (valorRealizado 0/null)
//   PARCIAL  → 0 < valorRealizado < valor
//   PAGO     → valorRealizado >= valor (dentro de 1 centavo)
//
// Onde "a receber/pagar" soma  = valor − COALESCE(valorRealizado,0)  para status IN (PENDENTE, PARCIAL)
// Onde "realizado/caixa" soma  = COALESCE(valorRealizado, valor)     para status IN (PAGO, PARCIAL)

const centavos = (n: number | null | undefined) => Math.round((Number(n) || 0) * 100)

export function round2(n: number | null | undefined): number {
  return centavos(n) / 100
}

export interface ResultadoPagamento {
  status: 'PAGO' | 'PARCIAL'
  valorRealizado: number
  saldo: number
}

// Acumula um pagamento sobre o realizado atual e decide o status.
// Nunca deixa o realizado passar do total (quitação limpa, sem excedente).
export function aplicarPagamento(
  valorTotal: number,
  realizadoAtual: number | null | undefined,
  valorPago: number,
): ResultadoPagamento {
  const totalC = centavos(valorTotal)
  const atualC = Math.max(0, centavos(realizadoAtual))
  const pagoC = Math.max(0, centavos(valorPago))
  let novoC = atualC + pagoC
  if (novoC > totalC) novoC = totalC
  const quitado = novoC >= totalC - 1 // tolerância 1 centavo
  const finalC = quitado ? totalC : novoC
  return {
    status: quitado ? 'PAGO' : 'PARCIAL',
    valorRealizado: finalC / 100,
    saldo: (totalC - finalC) / 100,
  }
}

// Deriva o status correto a partir do realizado vs total — usado no BACKFILL de
// registros que ficaram como PAGO indevidamente (parcial marcado como quitado).
export function statusPorRealizado(
  valorTotal: number,
  realizado: number | null | undefined,
): 'PENDENTE' | 'PARCIAL' | 'PAGO' {
  const totalC = centavos(valorTotal)
  const realC = Math.max(0, centavos(realizado))
  if (realC <= 0) return 'PENDENTE'
  if (realC >= totalC - 1) return 'PAGO'
  return 'PARCIAL'
}

// Saldo em aberto de um lançamento (0 se quitado). Em centavos-safe.
export function saldoLancamento(valorTotal: number, realizado: number | null | undefined): number {
  return Math.max(0, (centavos(valorTotal) - Math.max(0, centavos(realizado))) / 100)
}
