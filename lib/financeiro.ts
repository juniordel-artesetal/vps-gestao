// lib/financeiro.ts — regra de pagamento parcial/total (fonte única)
// valor = previsto/total ; valorRealizado = pago (acumulado) ; status ∈ PENDENTE|PARCIAL|PAGO

// "Dentro de 1 centavo = quitado" — cobre arredondamento de valores em BRL
// (ex.: pago 49,89 de 49,90 conta como PAGO, não fica PARCIAL por 1 centavo).
export const TOLERANCIA_CENTAVO = 0.01

/** Deriva o status pelo valor PAGO (realizado) vs o TOTAL previsto.
 *  0/nulo → PENDENTE ; >= total → PAGO ; entre → PARCIAL. */
export function statusPorPagamento(
  valorRealizado: number | null | undefined,
  valorTotal: number,
): 'PENDENTE' | 'PARCIAL' | 'PAGO' {
  const pago = Number(valorRealizado || 0)
  const total = Number(valorTotal || 0)
  if (pago <= TOLERANCIA_CENTAVO) return 'PENDENTE'
  if (pago >= total - TOLERANCIA_CENTAVO) return 'PAGO'
  return 'PARCIAL'
}

/** Arredonda para 2 casas evitando drift de float (centavos). */
export function centavos(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

/** Saldo pendente (nunca negativo). */
export function saldoPendente(valorTotal: number, valorRealizado: number | null | undefined): number {
  return centavos(Math.max(0, Number(valorTotal || 0) - Number(valorRealizado || 0)))
}
