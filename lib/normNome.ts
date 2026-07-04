// Normalização de nome SÓ para COMPARAR (o nome original é sempre preservado).
// trim, minúsculas, sem acento (diacríticos), espaços colapsados.
export function normNome(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export const soDigitos = (s: unknown) => String(s ?? '').replace(/\D/g, '')
